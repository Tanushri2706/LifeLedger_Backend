import { Types } from 'mongoose';
import { Hospital, HospitalDocument } from '../models';
import {
  GetHospitalsQueryDto,
  NormalizedHospitalDto,
  HospitalDetailsDto,
  NearbyHospitalsResponseDto,
  SearchHospitalsQueryDto,
  GetEmergencyHospitalsQueryDto,
  FacilitySortOption
} from '../types';
import { AppError } from '../utils';
import {
  createLocationProvider,
  ILocationProvider,
  IPlaceResult
} from './location';

const CANONICAL_DEPARTMENTS = [
  'Cardiology',
  'Dermatology',
  'Emergency Medicine',
  'Endocrinology',
  'ENT (Otolaryngology)',
  'Gastroenterology',
  'General Medicine',
  'General Surgery',
  'Nephrology',
  'Neurology',
  'Obstetrics & Gynecology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Pathology & Laboratory',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology & Imaging',
  'Urology'
];

export class HospitalService {
  private locationProvider: ILocationProvider;

  constructor(customProvider?: ILocationProvider) {
    this.locationProvider = customProvider || createLocationProvider();
  }

  public getLocationProvider(): ILocationProvider {
    return this.locationProvider;
  }

  public setLocationProvider(provider: ILocationProvider): void {
    this.locationProvider = provider;
  }

  /**
   * Maps a PlaceResult or Mongo Document to NormalizedHospitalDto.
   */
  private mapPlaceToDto(place: IPlaceResult): NormalizedHospitalDto {
    return {
      id: place.placeId,
      providerPlaceId: place.placeId,
      name: place.name,
      facilityType: place.type,
      types: place.types || [place.type],
      address: place.address,
      vicinity: place.vicinity,
      location: place.location,
      latitude: place.latitude,
      longitude: place.longitude,
      distanceKm: place.distanceKm ?? (place.distanceMeters !== undefined ? Math.round((place.distanceMeters / 1000) * 100) / 100 : null),
      distanceMeters: place.distanceMeters ?? null,
      rating: place.rating !== undefined ? place.rating : null,
      userRatingsTotal: place.userRatingsTotal ?? place.reviewCount ?? 0,
      reviewCount: place.reviewCount ?? place.userRatingsTotal ?? 0,
      isOpen: place.openNow ?? null,
      businessStatus: place.businessStatus ?? null,
      phone: place.phone ?? null,
      website: place.website ?? null,
      googleMapsUrl: place.googleMapsUrl,
      directionsUrl: place.directionsUrl,
      icon: place.icon ?? null,
      photos: place.photos,
      attribution: place.attribution
    };
  }

  private mapMongoDocToDto(doc: HospitalDocument): NormalizedHospitalDto {
    const json = doc.toJSON ? doc.toJSON() : doc;
    const lat = json.location?.coordinates?.[1] ?? 0;
    const lng = json.location?.coordinates?.[0] ?? 0;
    const id = json._id ? json._id.toString() : String(doc._id);

    return {
      id,
      providerPlaceId: id,
      name: json.name,
      facilityType: json.type || 'hospital',
      types: [json.type || 'hospital'],
      address: json.address,
      vicinity: json.city ? `${json.address}, ${json.city}` : json.address,
      location: json.location,
      latitude: lat,
      longitude: lng,
      distanceKm: null,
      distanceMeters: null,
      rating: typeof json.rating === 'number' ? json.rating : null,
      userRatingsTotal: json.reviewCount || 0,
      reviewCount: json.reviewCount || 0,
      isOpen: null,
      businessStatus: 'OPERATIONAL',
      phone: json.phone || null,
      website: json.website || null,
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(json.name)}`,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    };
  }

  /**
   * Discover real nearby healthcare facilities using the active location provider.
   */
  public async getNearbyHospitals(query: GetHospitalsQueryDto): Promise<NearbyHospitalsResponseDto> {
    const rawLat = query.latitude ?? query.lat;
    const rawLng = query.longitude ?? query.lng;

    if (rawLat === undefined || rawLng === undefined) {
      throw new AppError('Both latitude and longitude must be provided for nearby healthcare facility discovery', 400);
    }

    const latitude = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
    const longitude = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new AppError('Latitude must be a valid number between -90 and 90', 400);
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new AppError('Longitude must be a valid number between -180 and 180', 400);
    }

    // Determine radius in meters (max 50 km / 50,000 m, min 100 m / 0.1 km)
    let radiusMeters = 5000; // 5 km default
    if (query.radiusKm !== undefined) {
      const parsedKm = typeof query.radiusKm === 'number' ? query.radiusKm : parseFloat(String(query.radiusKm));
      if (isNaN(parsedKm) || parsedKm < 0.1) {
        throw new AppError('Search radius must be at least 0.1 km (100 meters)', 400);
      }
      if (parsedKm > 50) {
        throw new AppError('Search radius cannot exceed 50 km (50,000 meters)', 400);
      }
      radiusMeters = Math.round(parsedKm * 1000);
    } else if (query.radius !== undefined) {
      const parsed = typeof query.radius === 'number' ? query.radius : parseFloat(String(query.radius));
      if (isNaN(parsed)) {
        throw new AppError('Search radius must be a valid number', 400);
      }
      if (parsed < 100) {
        throw new AppError('Search radius must be at least 100 meters (0.1 km)', 400);
      }
      if (parsed > 50000) {
        throw new AppError('Search radius cannot exceed 50 km (50,000 meters)', 400);
      }
      radiusMeters = Math.round(parsed);
    }

    // Minimum rating filter
    let minRating: number | undefined;
    const rawMinRating = query.minRating ?? query.minimumRating;
    if (rawMinRating !== undefined) {
      minRating = typeof rawMinRating === 'number' ? rawMinRating : parseFloat(String(rawMinRating));
      if (isNaN(minRating) || minRating < 0 || minRating > 5) {
        throw new AppError('Minimum rating must be a valid number between 0 and 5', 400);
      }
    }

    // OpenNow filter
    let openNow: boolean | undefined;
    if (query.openNow !== undefined) {
      openNow = String(query.openNow).toLowerCase() === 'true' || String(query.openNow) === '1';
    }

    // Facility type
    const facilityType = query.type || query.category || query.facilityType;

    // Search keyword
    const keyword = query.search || query.query || query.keyword || query.q || query.speciality || query.department;

    // Sorting
    let sort: FacilitySortOption = 'distance';
    if (query.sort) {
      const s = String(query.sort).toLowerCase().trim();
      if (s === 'rating') sort = 'rating';
      else if (s === 'relevance') sort = 'relevance';
      else sort = 'distance';
    }

    // Pagination
    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit), 10) || 20));
    const skip = (page - 1) * limit;

    // Execute provider search
    const providerResult = await this.locationProvider.searchNearby({
      latitude,
      longitude,
      radiusMeters,
      type: facilityType,
      keyword,
      openNow,
      minRating,
      sort,
      pageToken: query.pageToken
    });

    const dtos = providerResult.places.map((p) => this.mapPlaceToDto(p));

    const total = providerResult.totalReturned;
    const paginated = dtos.slice(skip, skip + limit);
    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = page < totalPages;
    const searchRadiusKm = Math.round((radiusMeters / 1000) * 100) / 100;

    const response: NearbyHospitalsResponseDto = {
      provider: providerResult.provider,
      count: paginated.length,
      searchRadiusKm,
      distanceCalculation: 'geodesic_haversine',
      attribution: providerResult.attribution || (providerResult.provider === 'osm' ? '© OpenStreetMap contributors' : undefined),
      disclaimer: 'Distances represent straight-line geodesic distances calculated from supplied coordinates.',
      ...(searchRadiusKm >= 40
        ? {
            warning:
              'Searches across wide radiuses (40–50 km) return top-ranked facilities within the radius according to provider coverage limits rather than an exhaustive census.'
          }
        : {}),
      hospitals: paginated,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore,
        nextPageToken: providerResult.nextPageToken
      }
    };

    return response;
  }

  /**
   * Retrieve place details by provider Place ID or MongoDB ID.
   */
  public async getHospitalById(id: string): Promise<{ hospital: HospitalDetailsDto }> {
    const trimmedId = id?.trim();
    if (!trimmedId) {
      throw new AppError('Healthcare facility ID is required', 400);
    }

    // 1. First, check provider for real place details
    const providerPlace = await this.locationProvider.getPlaceDetails(trimmedId);
    if (providerPlace) {
      const baseDto = this.mapPlaceToDto(providerPlace);
      const detailsDto: HospitalDetailsDto = {
        ...baseDto,
        formattedAddress: providerPlace.formattedAddress || providerPlace.address,
        formattedPhone: providerPlace.phone,
        internationalPhone: providerPlace.internationalPhone,
        openingHours: providerPlace.openingHours,
        editorialSummary: providerPlace.editorialSummary
      };
      return { hospital: detailsDto };
    }

    // 2. Fallback check for MongoDB legacy hospital records if ID is a valid ObjectId
    if (Types.ObjectId.isValid(trimmedId)) {
      const mongoHospital = await Hospital.findOne({
        _id: new Types.ObjectId(trimmedId),
        isDeleted: false
      });
      if (mongoHospital) {
        const baseDto = this.mapMongoDocToDto(mongoHospital);
        const detailsDto: HospitalDetailsDto = {
          ...baseDto,
          formattedAddress: mongoHospital.address
        };
        return { hospital: detailsDto };
      }
    }

    throw new AppError('Healthcare facility not found', 404);
  }

  /**
   * Search healthcare facilities with text query or city geocoding.
   */
  public async searchHospitals(query: SearchHospitalsQueryDto): Promise<NearbyHospitalsResponseDto> {
    const rawLat = query.latitude ?? query.lat;
    const rawLng = query.longitude ?? query.lng;

    // 1. If coordinates provided, run nearby search directly with query
    if (rawLat !== undefined && rawLng !== undefined) {
      return this.getNearbyHospitals({
        ...query,
        keyword: query.search || query.query || query.q || query.speciality
      });
    }

    // 2. If city or text query provided, geocode anchor coordinates
    const locationQuery = query.city || query.search || query.query || query.q;
    if (locationQuery && locationQuery.trim()) {
      const geocoded = await this.locationProvider.geocode(locationQuery.trim());
      if (geocoded) {
        return this.getNearbyHospitals({
          ...query,
          latitude: geocoded.location.latitude,
          longitude: geocoded.location.longitude,
          keyword: query.speciality || (query.city ? query.search || query.query || query.q : undefined)
        });
      }
    }

    throw new AppError(
      'Both latitude and longitude (or a valid city name/address) must be provided for healthcare facility discovery',
      400
    );
  }

  /**
   * Get supported medical departments & specialties list.
   */
  public async getDepartments(): Promise<{ departments: string[]; count: number }> {
    return {
      departments: CANONICAL_DEPARTMENTS,
      count: CANONICAL_DEPARTMENTS.length
    };
  }

  /**
   * Discover emergency facilities with emergency medicine capabilities.
   */
  public async getEmergencyHospitals(query: GetEmergencyHospitalsQueryDto): Promise<NearbyHospitalsResponseDto> {
    return this.getNearbyHospitals({
      ...query,
      type: 'hospital',
      keyword: query.city ? undefined : 'emergency'
    });
  }
}

export const hospitalService: HospitalService = new HospitalService();
