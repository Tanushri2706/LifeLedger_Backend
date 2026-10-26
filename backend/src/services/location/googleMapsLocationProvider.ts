import {
  ILocationProvider,
  INearbyPlacesQuery,
  INearbyPlacesResult,
  IPlaceResult,
  IGeocodeResult
} from './locationProvider.interface';
import { calculateHaversineDistanceMeters } from './mockLocationProvider';
import { AppError } from '../../utils';

export class GoogleMapsLocationProvider implements ILocationProvider {
  public readonly providerName = 'google' as const;
  private readonly requestTimeoutMs = 8000;

  constructor(private readonly apiKey: string) {
    if (!this.apiKey || !this.apiKey.trim()) {
      throw new AppError('Google Maps API key is required for GoogleMapsLocationProvider', 500);
    }
  }

  /**
   * Helper to perform fetch with AbortController timeout and sanitize errors (never leak API key).
   */
  private async safeFetch(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      return response;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('Google Maps API request timed out after 8 seconds', 504);
      }
      throw new AppError('Network connection to Google Maps API failed', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  public async searchNearby(query: INearbyPlacesQuery): Promise<INearbyPlacesResult> {
    const {
      latitude,
      longitude,
      radiusMeters = 5000,
      type,
      keyword,
      openNow,
      minRating,
      sort = 'distance',
      pageToken,
      limit = 20
    } = query;

    // Google Places Nearby Search API has a hard maximum radius limit of 50,000 meters (50 km)
    const effectiveRadius = Math.min(50000, Math.max(100, Math.round(radiusMeters)));

    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.append('location', `${latitude},${longitude}`);
    url.searchParams.append('radius', String(effectiveRadius));
    url.searchParams.append('key', this.apiKey);

    // Map healthcare facility types to Google Places primary type or keyword
    if (type && type !== 'all') {
      const typeLower = type.toLowerCase().trim();
      if (typeLower === 'pharmacy') {
        url.searchParams.append('type', 'pharmacy');
      } else if (typeLower === 'clinic') {
        url.searchParams.append('type', 'doctor');
      } else if (typeLower === 'diagnostic_center') {
        url.searchParams.append('keyword', keyword ? `${keyword} diagnostic laboratory pathology` : 'diagnostic laboratory pathology');
      } else if (typeLower === 'blood_bank') {
        url.searchParams.append('keyword', keyword ? `${keyword} blood bank` : 'blood bank');
      } else {
        url.searchParams.append('type', 'hospital');
      }
    } else {
      url.searchParams.append('type', 'hospital');
    }

    if (keyword && !url.searchParams.has('keyword')) {
      url.searchParams.append('keyword', keyword);
    }

    if (openNow === true) {
      url.searchParams.append('opennow', 'true');
    }

    if (pageToken) {
      url.searchParams.append('pagetoken', pageToken);
    }

    const response = await this.safeFetch(url);

    if (!response.ok) {
      throw new AppError(`Google Places API returned HTTP status ${response.status}`, 502);
    }

    const data = (await response.json()) as {
      status?: string;
      error_message?: string;
      results?: Array<{
        place_id: string;
        name: string;
        vicinity?: string;
        formatted_address?: string;
        geometry?: {
          location?: {
            lat: number;
            lng: number;
          };
        };
        rating?: number;
        user_ratings_total?: number;
        business_status?: string;
        types?: string[];
        opening_hours?: {
          open_now?: boolean;
        };
        icon?: string;
        photos?: Array<{
          photo_reference: string;
          height: number;
          width: number;
          html_attributions: string[];
        }>;
      }>;
      next_page_token?: string;
    };

    const status = data.status || 'UNKNOWN';

    if (status === 'ZERO_RESULTS') {
      return {
        provider: 'google',
        places: [],
        totalReturned: 0
      };
    }

    if (status === 'OVER_QUERY_LIMIT') {
      throw new AppError('Google Places API quota exceeded. Please check billing or quota limits.', 503);
    }

    if (status === 'REQUEST_DENIED') {
      throw new AppError('Google Places API request was denied. Please verify API key permissions.', 502);
    }

    if (status === 'INVALID_REQUEST') {
      throw new AppError('Invalid request parameters for Google Places search.', 400);
    }

    if (status !== 'OK' || !Array.isArray(data.results)) {
      throw new AppError(`Google Places search returned status: ${status}`, 502);
    }

    let places: IPlaceResult[] = data.results.map((place) => {
      const lat = place.geometry?.location?.lat ?? latitude;
      const lng = place.geometry?.location?.lng ?? longitude;
      const distanceMeters = calculateHaversineDistanceMeters(latitude, longitude, lat, lng);
      const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

      const primaryType = type && type !== 'all' ? type : 'hospital';
      const address = place.vicinity || place.formatted_address || place.name;

      const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${place.place_id}`;
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;

      return {
        placeId: place.place_id,
        name: place.name,
        type: primaryType,
        types: place.types || ['hospital', 'health', 'point_of_interest', 'establishment'],
        address,
        vicinity: place.vicinity,
        formattedAddress: place.formatted_address,
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        latitude: lat,
        longitude: lng,
        distanceMeters,
        distanceKm,
        rating: typeof place.rating === 'number' ? place.rating : null,
        reviewCount: typeof place.user_ratings_total === 'number' ? place.user_ratings_total : 0,
        userRatingsTotal: typeof place.user_ratings_total === 'number' ? place.user_ratings_total : 0,
        phone: null,
        internationalPhone: null,
        website: null,
        openNow: place.opening_hours?.open_now ?? null,
        businessStatus: place.business_status || null,
        googleMapsUrl,
        directionsUrl,
        icon: place.icon || null,
        photos: place.photos?.map((p) => ({
          photoReference: p.photo_reference,
          height: p.height,
          width: p.width,
          attributions: p.html_attributions || []
        }))
      };
    });

    // 1. Strict geodesic radius filter
    places = places.filter((p) => (p.distanceMeters ?? 0) <= effectiveRadius);

    // 2. Minimum rating filter
    if (typeof minRating === 'number' && !isNaN(minRating)) {
      places = places.filter((p) => p.rating !== null && p.rating >= minRating);
    }

    // 3. Deterministic sorting
    if (sort === 'distance') {
      places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    } else if (sort === 'rating') {
      places.sort((a, b) => {
        const ratingA = a.rating ?? -1;
        const ratingB = b.rating ?? -1;
        if (ratingB !== ratingA) {
          return ratingB - ratingA;
        }
        if (b.reviewCount !== a.reviewCount) {
          return b.reviewCount - a.reviewCount;
        }
        return (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
      });
    }

    const cappedLimit = Math.min(50, Math.max(1, limit));
    const paginated = places.slice(0, cappedLimit);

    return {
      provider: 'google',
      places: paginated,
      totalReturned: places.length,
      nextPageToken: data.next_page_token || null
    };
  }

  public async getPlaceDetails(placeId: string): Promise<IPlaceResult | null> {
    if (!placeId || !placeId.trim()) {
      return null;
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.append('place_id', placeId.trim());
    url.searchParams.append(
      'fields',
      'place_id,name,formatted_address,vicinity,geometry,rating,user_ratings_total,formatted_phone_number,international_phone_number,website,opening_hours,business_status,types,photos,url,editorial_summary'
    );
    url.searchParams.append('key', this.apiKey);

    const response = await this.safeFetch(url);

    if (!response.ok) {
      throw new AppError(`Google Place Details returned HTTP status ${response.status}`, 502);
    }

    const data = (await response.json()) as {
      status?: string;
      result?: {
        place_id: string;
        name: string;
        formatted_address?: string;
        vicinity?: string;
        geometry?: {
          location?: {
            lat: number;
            lng: number;
          };
        };
        rating?: number;
        user_ratings_total?: number;
        formatted_phone_number?: string;
        international_phone_number?: string;
        website?: string;
        opening_hours?: {
          open_now?: boolean;
          weekday_text?: string[];
        };
        business_status?: string;
        types?: string[];
        photos?: Array<{
          photo_reference: string;
          height: number;
          width: number;
          html_attributions: string[];
        }>;
        url?: string;
        editorial_summary?: {
          overview?: string;
        };
      };
    };

    const status = data.status;
    if (status === 'NOT_FOUND' || status === 'ZERO_RESULTS' || !data.result) {
      return null;
    }

    if (status === 'OVER_QUERY_LIMIT') {
      throw new AppError('Google Places API quota exceeded. Please check billing or quota limits.', 503);
    }

    if (status === 'REQUEST_DENIED') {
      throw new AppError('Google Places API request was denied. Please check API key permissions.', 502);
    }

    if (status !== 'OK') {
      return null;
    }

    const res = data.result;
    const lat = res.geometry?.location?.lat ?? 0;
    const lng = res.geometry?.location?.lng ?? 0;

    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${res.place_id}`;
    const googleMapsUrl = res.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(res.name)}&query_place_id=${res.place_id}`;

    return {
      placeId: res.place_id,
      name: res.name,
      type: 'hospital',
      types: res.types || ['hospital', 'health', 'point_of_interest', 'establishment'],
      address: res.formatted_address || res.vicinity || res.name,
      vicinity: res.vicinity,
      formattedAddress: res.formatted_address,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      latitude: lat,
      longitude: lng,
      rating: typeof res.rating === 'number' ? res.rating : null,
      reviewCount: typeof res.user_ratings_total === 'number' ? res.user_ratings_total : 0,
      userRatingsTotal: typeof res.user_ratings_total === 'number' ? res.user_ratings_total : 0,
      phone: res.formatted_phone_number || null,
      internationalPhone: res.international_phone_number || null,
      website: res.website || null,
      openNow: res.opening_hours?.open_now ?? null,
      businessStatus: res.business_status || null,
      googleMapsUrl,
      directionsUrl,
      openingHours: res.opening_hours
        ? {
            openNow: res.opening_hours.open_now ?? null,
            weekdayText: res.opening_hours.weekday_text || []
          }
        : undefined,
      photos: res.photos?.map((p) => ({
        photoReference: p.photo_reference,
        height: p.height,
        width: p.width,
        attributions: p.html_attributions || []
      })),
      editorialSummary: res.editorial_summary?.overview || null
    };
  }

  public async geocode(address: string): Promise<IGeocodeResult | null> {
    if (!address || !address.trim()) return null;

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.append('address', address.trim());
    url.searchParams.append('key', this.apiKey);

    const response = await this.safeFetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      results?: Array<{
        formatted_address: string;
        place_id: string;
        geometry: {
          location: {
            lat: number;
            lng: number;
          };
        };
        address_components?: Array<{
          long_name: string;
          short_name: string;
          types: string[];
        }>;
      }>;
    };

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return null;
    }

    const first = data.results[0];
    if (!first) {
      return null;
    }
    let city: string | undefined;
    let state: string | undefined;
    let country: string | undefined;

    first.address_components?.forEach((comp) => {
      if (comp.types.includes('locality')) city = comp.long_name;
      if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
      if (comp.types.includes('country')) country = comp.long_name;
    });

    return {
      formattedAddress: first.formatted_address,
      location: {
        latitude: first.geometry.location.lat,
        longitude: first.geometry.location.lng
      },
      placeId: first.place_id,
      city,
      state,
      country
    };
  }
}
