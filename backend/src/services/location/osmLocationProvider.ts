import {
  ILocationProvider,
  INearbyPlacesQuery,
  INearbyPlacesResult,
  IPlaceResult,
  IGeocodeResult
} from './locationProvider.interface';
import { calculateHaversineDistanceMeters } from './mockLocationProvider';
import { AppError } from '../../utils';

export interface OsmLocationProviderOptions {
  overpassUrl?: string;
  nominatimUrl?: string;
  requestTimeoutMs?: number;
  userAgent?: string;
  enableCache?: boolean;
}

export interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: {
    lat: number;
    lon: number;
  };
  tags?: Record<string, string>;
}

export interface OsmOverpassResponse {
  version?: number;
  generator?: string;
  elements?: OsmElement[];
  remark?: string;
}

export interface NominatimSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    neighbourhood?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export class OsmLocationProvider implements ILocationProvider {
  public readonly providerName = 'osm' as const;

  private readonly overpassUrl: string;
  private readonly nominatimUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly userAgent: string;
  private readonly enableCache: boolean;
  private readonly overpassMirrors: string[];

  // In-memory caching with TTL
  private readonly nearbyCache = new Map<string, { timestamp: number; data: IPlaceResult[] }>();
  private readonly detailsCache = new Map<string, { timestamp: number; data: IPlaceResult }>();
  private readonly geocodeCache = new Map<string, { timestamp: number; data: IGeocodeResult }>();

  private readonly nearbyCacheTtlMs = 5 * 60 * 1000; // 5 minutes
  private readonly detailsCacheTtlMs = 15 * 60 * 1000; // 15 minutes
  private readonly geocodeCacheTtlMs = 24 * 60 * 60 * 1000; // 24 hours

  // Nominatim rate limiting (Strictly 1 request/sec max as per OSM Public Policy)
  private lastNominatimRequestTime = 0;
  private nominatimQueue: Promise<unknown> = Promise.resolve();

  constructor(options: OsmLocationProviderOptions = {}) {
    this.overpassUrl = options.overpassUrl || 'https://overpass-api.de/api/interpreter';
    this.nominatimUrl = options.nominatimUrl || 'https://nominatim.openstreetmap.org';
    this.requestTimeoutMs = options.requestTimeoutMs ?? 25000;
    this.userAgent =
      options.userAgent ||
      'LifeLedger-HealthApp/1.0 (https://lifeledger-health.vercel.app; lifeledger.support@gmail.com)';
    this.enableCache = options.enableCache ?? true;

    // Primary server first, then public mirrors as fallbacks (deduplicated)
    this.overpassMirrors = [
      this.overpassUrl,
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.private.coffee/api/interpreter'
    ].filter((u, i, arr) => arr.indexOf(u) === i);
  }

  /**
   * Resets all internal in-memory caches (primarily for unit tests).
   */
  public clearCache(): void {
    this.nearbyCache.clear();
    this.detailsCache.clear();
    this.geocodeCache.clear();
  }

  /**
   * Safe fetch with AbortController timeout and standard error wrapping.
   */
  private async safeFetch(
    url: string,
    options: {
      method?: string;
      body?: string;
      headers?: Record<string, string>;
      timeoutMs?: number;
    } = {}
  ): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        body: options.body,
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
          ...(options.headers || {})
        }
      });
      return response;
    } catch (error: unknown) {
      const cause =
        error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
      console.error(
        '[OSM] fetch failed:',
        url,
        error instanceof Error ? error.message : error,
        cause ?? ''
      );

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(
          `OpenStreetMap API request timed out after ${Math.round(timeoutMs / 1000)} seconds`,
          504
        );
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Network connection to OpenStreetMap API failed', 502);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Tries each Overpass server in order; falls through to the next on
   * network errors, timeouts, or 429/502/503/504 responses.
   */
  private async fetchOverpass(body: string): Promise<Response> {
    let lastError: unknown = null;
    let lastResponse: Response | null = null;

    for (const url of this.overpassMirrors) {
      try {
        const response = await this.safeFetch(url, {
          method: 'POST',
          body,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
          },
          timeoutMs: 15000
        });
        if ([429, 502, 503, 504].includes(response.status)) {
          console.warn(`[OSM] Overpass ${url} returned ${response.status}, trying next server`);
          lastResponse = response;
          continue;
        }
        return response;
      } catch (error) {
        console.warn(
          `[OSM] Overpass ${url} failed:`,
          error instanceof Error ? error.message : error
        );
        lastError = error;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError instanceof Error
      ? lastError
      : new AppError('Network connection to OpenStreetMap API failed', 502);
  }

  /**
   * Serializes requests to public Nominatim ensuring >= 1000ms spacing.
   */
  private async scheduleNominatimRequest<T>(fn: () => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      const now = Date.now();
      const elapsed = now - this.lastNominatimRequestTime;
      if (elapsed < 1000) {
        await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
      }
      this.lastNominatimRequestTime = Date.now();
      return fn();
    };

    const nextTask = this.nominatimQueue.then(execute, execute);
    this.nominatimQueue = nextTask.then(
      () => { },
      () => { }
    );
    return nextTask as Promise<T>;
  }

  /**
   * Builds an Overpass QL query bounded to a specific radius and healthcare category.
   * Uses node and way statements (avoiding heavy recursive relation traversal) for optimal performance across 5-50km.
   */
  private buildOverpassQuery(
    lat: number,
    lon: number,
    radiusMeters: number,
    type?: string
  ): string {
    const r = Math.min(50000, Math.max(100, Math.round(radiusMeters)));
    const typeLower = (type || 'all').toLowerCase().trim();

    let targetClauses: string[];

    if (typeLower === 'pharmacy') {
      targetClauses = [
        `node["amenity"="pharmacy"](around:${r},${lat},${lon});`,
        `way["amenity"="pharmacy"](around:${r},${lat},${lon});`,
        `node["healthcare"="pharmacy"](around:${r},${lat},${lon});`,
        `way["healthcare"="pharmacy"](around:${r},${lat},${lon});`
      ];
    } else if (typeLower === 'clinic') {
      targetClauses = [
        `node["amenity"~"^(clinic|doctors)$"](around:${r},${lat},${lon});`,
        `way["amenity"~"^(clinic|doctors)$"](around:${r},${lat},${lon});`,
        `node["healthcare"~"^(clinic|doctor)$"](around:${r},${lat},${lon});`,
        `way["healthcare"~"^(clinic|doctor)$"](around:${r},${lat},${lon});`
      ];
    } else if (typeLower === 'blood_bank') {
      targetClauses = [
        `node["amenity"="blood_bank"](around:${r},${lat},${lon});`,
        `way["amenity"="blood_bank"](around:${r},${lat},${lon});`,
        `node["healthcare"~"^(blood_bank|blood_donation)$"](around:${r},${lat},${lon});`,
        `way["healthcare"~"^(blood_bank|blood_donation)$"](around:${r},${lat},${lon});`
      ];
    } else if (typeLower === 'diagnostic_center') {
      targetClauses = [
        `node["amenity"="laboratory"](around:${r},${lat},${lon});`,
        `way["amenity"="laboratory"](around:${r},${lat},${lon});`,
        `node["healthcare"~"^(laboratory|diagnostic_centre)$"](around:${r},${lat},${lon});`,
        `way["healthcare"~"^(laboratory|diagnostic_centre)$"](around:${r},${lat},${lon});`
      ];
    } else {
      // Default: Hospitals, clinics, doctors, emergency healthcare
      targetClauses = [
        `node["amenity"~"^(hospital|clinic|doctors)$"](around:${r},${lat},${lon});`,
        `way["amenity"~"^(hospital|clinic|doctors)$"](around:${r},${lat},${lon});`,
        `node["healthcare"~"^(hospital|clinic|doctor)$"](around:${r},${lat},${lon});`,
        `way["healthcare"~"^(hospital|clinic|doctor)$"](around:${r},${lat},${lon});`
      ];
    }

    return `[out:json][timeout:25];\n(\n  ${targetClauses.join('\n  ')}\n);\nout center tags;`;
  }

  /**
   * Determines canonical LifeLedger facility type from OSM tags.
   */
  private deriveFacilityType(tags: Record<string, string>): string {
    const amenity = tags.amenity?.toLowerCase();
    const healthcare = tags.healthcare?.toLowerCase();

    if (amenity === 'pharmacy' || healthcare === 'pharmacy') return 'pharmacy';
    if (
      amenity === 'clinic' ||
      healthcare === 'clinic' ||
      amenity === 'doctors' ||
      healthcare === 'doctor'
    )
      return 'clinic';
    if (
      amenity === 'blood_bank' ||
      healthcare === 'blood_bank' ||
      healthcare === 'blood_donation'
    )
      return 'blood_bank';
    if (
      healthcare === 'laboratory' ||
      healthcare === 'diagnostic_centre' ||
      amenity === 'laboratory'
    )
      return 'diagnostic_center';
    if (amenity === 'hospital' || healthcare === 'hospital') return 'hospital';
    if (tags.emergency === 'yes') return 'hospital';

    return 'hospital';
  }

  /**
   * Honest address derivation from OSM addr:* tags without fabricating missing parts.
   */
  private deriveAddress(
    tags: Record<string, string>,
    fallbackName: string,
    lat: number,
    lon: number
  ): { address: string; vicinity?: string; formattedAddress?: string } {
    if (tags['addr:full']) {
      return {
        address: tags['addr:full'],
        vicinity: tags['addr:city'] || tags['addr:suburb'] || undefined,
        formattedAddress: tags['addr:full']
      };
    }

    const streetNumber = tags['addr:housenumber'];
    const streetName = tags['addr:street'];
    const street =
      streetNumber && streetName
        ? `${streetNumber} ${streetName}`
        : streetName || streetNumber;
    const suburb =
      tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district'];
    const city =
      tags['addr:city'] ||
      tags['addr:town'] ||
      tags['addr:village'] ||
      tags['addr:municipality'];
    const postcode = tags['addr:postcode'];
    const state = tags['addr:state'];
    const country = tags['addr:country'];

    const parts = [street, suburb, city, postcode, state, country].filter(Boolean);

    if (parts.length > 0) {
      const formatted = parts.join(', ');
      const vicinity =
        [suburb, city].filter(Boolean).join(', ') || city || suburb || undefined;
      return {
        address: formatted,
        vicinity,
        formattedAddress: formatted
      };
    }

    // Honest fallback: never invent fake streets
    const fallback = fallbackName
      ? fallbackName
      : `Healthcare Facility (${lat.toFixed(4)}, ${lon.toFixed(4)})`;

    return {
      address: fallback,
      vicinity: undefined,
      formattedAddress: fallback
    };
  }

  /**
   * Normalizes an Overpass OSM element into the standard LifeLedger IPlaceResult contract.
   */
  private normalizeOsmElement(
    element: OsmElement,
    queryLat: number,
    queryLon: number
  ): IPlaceResult | null {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;

    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return null;
    }

    const tags = element.tags || {};
    const facilityType = this.deriveFacilityType(tags);

    const rawName =
      tags.name ||
      tags['name:en'] ||
      tags.official_name ||
      tags.operator ||
      tags.brand;
    const name =
      rawName?.trim() ||
      `${facilityType.charAt(0).toUpperCase() + facilityType.slice(1)}`;

    const distanceMeters = calculateHaversineDistanceMeters(
      queryLat,
      queryLon,
      lat,
      lon
    );
    const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;

    const { address, vicinity, formattedAddress } = this.deriveAddress(
      tags,
      name,
      lat,
      lon
    );

    const types: string[] = [facilityType, 'health', 'point_of_interest'];
    if (tags.amenity) types.push(tags.amenity.toLowerCase());
    if (tags.healthcare) types.push(tags.healthcare.toLowerCase());
    if (tags.emergency === 'yes') types.push('emergency');

    const phone =
      tags.phone ||
      tags['contact:phone'] ||
      tags['emergency:phone'] ||
      tags.mobile ||
      tags['contact:mobile'] ||
      null;

    const internationalPhone = tags['contact:phone'] || tags.phone || null;
    const website = tags.website || tags['contact:website'] || tags.url || null;

    let openNow: boolean | null = null;
    let openingHours:
      | { openNow?: boolean | null; weekdayText?: string[] }
      | undefined = undefined;

    if (tags.opening_hours) {
      const rawHours = tags.opening_hours.trim();
      const is24x7 =
        rawHours.toLowerCase() === '24/7' || rawHours.toLowerCase() === '24 hours';
      if (is24x7) {
        openNow = true;
      }
      openingHours = {
        openNow,
        weekdayText: [rawHours]
      };
    }

    const placeId = `osm_${element.type}_${element.id}`;
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

    const editorialSummary =
      tags.description ||
      tags.operator ||
      (tags.emergency === 'yes' ? 'Emergency healthcare facility' : null);

    const businessStatus =
      tags.disused === 'yes' || tags.abandoned === 'yes'
        ? 'CLOSED_PERMANENTLY'
        : 'OPERATIONAL';

    return {
      placeId,
      name,
      type: facilityType,
      types,
      address,
      vicinity,
      formattedAddress,
      location: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      latitude: lat,
      longitude: lon,
      distanceMeters,
      distanceKm,
      rating: null, // Honest: OSM does not maintain commercial star ratings
      reviewCount: 0,
      userRatingsTotal: 0,
      phone,
      internationalPhone,
      website,
      openNow,
      businessStatus,
      googleMapsUrl,
      directionsUrl,
      icon: null,
      photos: undefined,
      openingHours,
      editorialSummary,
      attribution: '© OpenStreetMap contributors'
    };
  }

  /**
   * Deduplicates place results when OSM contains overlapping node/way representations.
   */
  private deduplicatePlaces(places: IPlaceResult[]): IPlaceResult[] {
    const seenIds = new Set<string>();
    const unique: IPlaceResult[] = [];

    for (const place of places) {
      if (seenIds.has(place.placeId)) continue;
      seenIds.add(place.placeId);

      const isDuplicate = unique.some((existing) => {
        if (existing.name.toLowerCase() === place.name.toLowerCase()) {
          const dist = calculateHaversineDistanceMeters(
            existing.latitude,
            existing.longitude,
            place.latitude,
            place.longitude
          );
          return dist < 15;
        }
        return false;
      });

      if (!isDuplicate) {
        unique.push(place);
      }
    }

    return unique;
  }

  /**
   * Search nearby healthcare facilities via OpenStreetMap Overpass API.
   */
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
      limit
    } = query;

    if (
      typeof latitude !== 'number' ||
      isNaN(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      throw new AppError('Latitude must be a valid number between -90 and 90', 400);
    }
    if (
      typeof longitude !== 'number' ||
      isNaN(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new AppError('Longitude must be a valid number between -180 and 180', 400);
    }

    const effectiveRadius = Math.min(50000, Math.max(100, Math.round(radiusMeters)));

    // Cache key based on rounded query parameters
    const roundedLat = Math.round(latitude * 1000) / 1000;
    const roundedLon = Math.round(longitude * 1000) / 1000;
    const cacheKey = `${roundedLat}_${roundedLon}_${effectiveRadius}_${type || 'all'}`;

    let rawPlaces: IPlaceResult[] | null = null;
    if (this.enableCache) {
      const cached = this.nearbyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.nearbyCacheTtlMs) {
        rawPlaces = cached.data;
      }
    }

    if (!rawPlaces) {
      const overpassQuery = this.buildOverpassQuery(
        latitude,
        longitude,
        effectiveRadius,
        type
      );
      const body = `data=${encodeURIComponent(overpassQuery)}`;

      const response = await this.fetchOverpass(body);

      if (response.status === 429) {
        throw new AppError(
          'OpenStreetMap Overpass API rate limit exceeded. Please try again shortly.',
          429
        );
      }

      if (response.status === 504) {
        throw new AppError('OpenStreetMap Overpass API gateway timed out', 504);
      }

      if (response.status === 502 || response.status === 503) {
        throw new AppError(
          `OpenStreetMap Overpass API service is temporarily unavailable (HTTP ${response.status})`,
          response.status
        );
      }

      if (!response.ok) {
        throw new AppError(
          `OpenStreetMap Overpass API returned HTTP status ${response.status}`,
          502
        );
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      // Check if Overpass returned an HTML/XML rate-limit or error page
      if (text.trim().startsWith('<') || (!contentType.includes('json') && text.includes('<html>'))) {
        if (text.includes('rate_limited') || text.includes('quota') || text.includes('429')) {
          throw new AppError(
            'OpenStreetMap Overpass API rate limit exceeded. Please try again shortly.',
            429
          );
        }
        if (text.includes('timed out') || text.includes('timeout') || text.includes('504')) {
          throw new AppError('OpenStreetMap Overpass API request timed out', 504);
        }
        throw new AppError(
          'OpenStreetMap Overpass API returned a non-JSON response. The service may be experiencing high load.',
          502
        );
      }

      let data: OsmOverpassResponse;
      try {
        data = JSON.parse(text) as OsmOverpassResponse;
      } catch {
        throw new AppError(
          'Malformed response received from OpenStreetMap Overpass API',
          502
        );
      }

      if (data.remark && (data.remark.includes('timed out') || data.remark.includes('runtime error'))) {
        if (data.remark.includes('timed out') || data.remark.includes('timeout')) {
          throw new AppError('OpenStreetMap Overpass API query execution timed out on the server', 504);
        }
        if (data.remark.includes('rate_limited') || data.remark.includes('quota')) {
          throw new AppError('OpenStreetMap Overpass API rate limit exceeded. Please try again shortly.', 429);
        }
      }

      if (!data || !Array.isArray(data.elements)) {
        return {
          provider: 'osm',
          places: [],
          totalReturned: 0,
          attribution: '© OpenStreetMap contributors'
        };
      }

      const normalized = data.elements
        .map((el) => this.normalizeOsmElement(el, latitude, longitude))
        .filter((p): p is IPlaceResult => p !== null);

      rawPlaces = this.deduplicatePlaces(normalized);

      if (this.enableCache) {
        this.nearbyCache.set(cacheKey, { timestamp: Date.now(), data: rawPlaces });
        for (const p of rawPlaces) {
          this.detailsCache.set(p.placeId, { timestamp: Date.now(), data: p });
        }
      }
    }

    // Calculate straight-line geodesic distance accurately from query coordinates
    let places = rawPlaces.map((p) => {
      const distanceMeters = calculateHaversineDistanceMeters(
        latitude,
        longitude,
        p.latitude,
        p.longitude
      );
      const distanceKm = Math.round((distanceMeters / 1000) * 100) / 100;
      return {
        ...p,
        distanceMeters,
        distanceKm
      };
    });

    // 1. Strict geodesic radius filter
    places = places.filter((p) => (p.distanceMeters ?? 0) <= effectiveRadius);

    // 2. Keyword filter
    if (keyword && keyword.trim()) {
      const q = keyword.toLowerCase().trim();
      const terms = q.split(/\s+/).filter(Boolean);
      places = places.filter((p) => {
        const searchable = [
          p.name,
          p.address,
          p.vicinity || '',
          p.formattedAddress || '',
          p.editorialSummary || '',
          p.type,
          ...p.types
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(q) || terms.some((term) => searchable.includes(term));
      });
    }

    // 3. OpenNow filter
    if (openNow === true) {
      places = places.filter((p) => p.openNow === true);
    }

    // 4. MinRating filter (OSM places have rating null)
    if (typeof minRating === 'number' && !isNaN(minRating)) {
      places = places.filter((p) => p.rating !== null && p.rating >= minRating);
    }

    // 5. Deterministic sorting
    if (sort === 'distance' || sort === 'relevance') {
      places.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
    } else if (sort === 'rating') {
      places.sort((a, b) => {
        const ratingA = a.rating ?? -1;
        const ratingB = b.rating ?? -1;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
      });
    }

    const paginated = typeof limit === 'number' && limit > 0 ? places.slice(0, limit) : places;

    return {
      provider: 'osm',
      places: paginated,
      totalReturned: places.length,
      attribution: '© OpenStreetMap contributors'
    };
  }

  /**
   * Retrieve facility details by OSM Place ID.
   */
  public async getPlaceDetails(placeId: string): Promise<IPlaceResult | null> {
    const trimmedId = placeId?.trim();
    if (!trimmedId) return null;

    if (this.enableCache) {
      const cached = this.detailsCache.get(trimmedId);
      if (cached && Date.now() - cached.timestamp < this.detailsCacheTtlMs) {
        return { ...cached.data };
      }
    }

    // Parse OSM element type and numeric ID
    let osmType = 'node';
    let osmId = '';

    if (trimmedId.startsWith('osm_')) {
      const parts = trimmedId.replace('osm_', '').split('_');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        osmType = parts[0];
        osmId = parts[1];
      } else {
        osmId = parts[0] || '';
      }
    } else if (trimmedId.includes('/')) {
      const parts = trimmedId.split('/');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        osmType = parts[0].replace('osm:', '');
        osmId = parts[1];
      } else {
        osmId = parts[0] || '';
      }
    } else {
      osmId = trimmedId;
    }

    if (!/^\d+$/.test(osmId)) {
      return null;
    }

    let overpassQuery: string;
    if (['node', 'way', 'relation'].includes(osmType)) {
      overpassQuery = `[out:json][timeout:10];\n(\n  ${osmType}(${osmId});\n);\nout center tags;`;
    } else {
      overpassQuery = `[out:json][timeout:10];\n(\n  node(${osmId});\n  way(${osmId});\n  relation(${osmId});\n);\nout center tags;`;
    }

    try {
      const response = await this.safeFetch(this.overpassUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
      });

      if (!response.ok) return null;

      const data = (await response.json()) as OsmOverpassResponse;
      if (!data.elements || data.elements.length === 0) return null;

      const element = data.elements[0];
      if (!element) return null;

      const lat = element.lat ?? element.center?.lat ?? 0;
      const lon = element.lon ?? element.center?.lon ?? 0;

      const place = this.normalizeOsmElement(element, lat, lon);
      if (!place) return null;

      if (this.enableCache) {
        this.detailsCache.set(trimmedId, { timestamp: Date.now(), data: place });
      }

      return place;
    } catch {
      return null;
    }
  }

  /**
   * Geocodes an address or city name using Nominatim (strictly rate-limited and cached).
   * Note: Autocomplete is never performed with public Nominatim.
   */
  public async geocode(address: string): Promise<IGeocodeResult | null> {
    const trimmed = address?.trim();
    if (!trimmed) return null;

    // Sanitize: Never forward clinical or sensitive patient tokens
    const cleanAddress = trimmed
      .replace(
        /\b(patient|diagnosis|dengue|diabetes|cancer|vitals|bp|sugar|medical|report|rx|prescription)\b/gi,
        ''
      )
      .trim();

    if (!cleanAddress) return null;

    const cacheKey = cleanAddress.toLowerCase();
    if (this.enableCache) {
      const cached = this.geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.geocodeCacheTtlMs) {
        return { ...cached.data };
      }
    }

    return this.scheduleNominatimRequest(async () => {
      try {
        const url = new URL(`${this.nominatimUrl.replace(/\/+$/, '')}/search`);
        url.searchParams.append('format', 'json');
        url.searchParams.append('q', cleanAddress);
        url.searchParams.append('addressdetails', '1');
        url.searchParams.append('limit', '1');

        const response = await this.safeFetch(url.toString(), {
          headers: {
            'User-Agent': this.userAgent,
            Accept: 'application/json'
          }
        });

        if (!response.ok) return null;

        const results = (await response.json()) as NominatimSearchResult[];
        if (!Array.isArray(results) || results.length === 0) return null;

        const first = results[0];
        if (!first) return null;

        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);

        if (isNaN(lat) || isNaN(lon)) return null;

        const city =
          first.address?.city ||
          first.address?.town ||
          first.address?.village ||
          first.address?.municipality ||
          first.address?.suburb;

        const geocodeResult: IGeocodeResult = {
          formattedAddress: first.display_name,
          location: {
            latitude: lat,
            longitude: lon
          },
          placeId: `osm_nominatim_${first.place_id}`,
          city,
          state: first.address?.state,
          country: first.address?.country
        };

        if (this.enableCache) {
          this.geocodeCache.set(cacheKey, {
            timestamp: Date.now(),
            data: geocodeResult
          });
        }

        return geocodeResult;
      } catch {
        return null;
      }
    });
  }
}