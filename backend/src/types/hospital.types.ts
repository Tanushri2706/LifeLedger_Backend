export enum HealthcareFacilityType {
  HOSPITAL = 'hospital',
  CLINIC = 'clinic',
  DIAGNOSTIC_CENTER = 'diagnostic_center',
  PHARMACY = 'pharmacy',
  BLOOD_BANK = 'blood_bank',
  OTHER = 'other'
}

export type FacilitySortOption = 'distance' | 'rating' | 'relevance';

export interface IGeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface IHospital {
  name: string;
  type: HealthcareFacilityType | string;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  location: IGeoLocation;
  rating?: number | null;
  reviewCount: number;
  phone?: string;
  email?: string;
  website?: string;
  specialities: string[];
  emergencyAvailable?: boolean;
  ambulanceAvailable?: boolean;
  bloodBankAvailable?: boolean;
  operatingHours?: string;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GetHospitalsQueryDto {
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  radius?: number | string; // in meters (e.g. 5000) or km (if <= 50)
  radiusKm?: number | string; // in km (e.g. 5, 10, 50)
  type?: string;
  category?: string;
  facilityType?: string;
  search?: string;
  query?: string;
  keyword?: string;
  q?: string;
  speciality?: string;
  department?: string;
  city?: string;
  emergency?: boolean | string;
  openNow?: boolean | string;
  minRating?: number | string;
  minimumRating?: number | string;
  sort?: FacilitySortOption | string;
  page?: number | string;
  limit?: number | string;
  pageToken?: string;
}

export interface NormalizedHospitalDto {
  id: string; // Google Place ID or Provider Place ID
  providerPlaceId: string;
  name: string;
  facilityType: string;
  types: string[];
  address: string;
  vicinity?: string;
  location: IGeoLocation;
  latitude: number;
  longitude: number;
  distanceKm: number | null; // Geodesic / straight-line geographic distance in km
  distanceMeters: number | null;
  rating: number | null; // Real rating or null (never fabricated)
  userRatingsTotal: number;
  reviewCount: number; // Alias for userRatingsTotal
  isOpen: boolean | null; // Real opening status from provider if available
  businessStatus?: string | null;
  phone?: string | null;
  website?: string | null;
  googleMapsUrl: string;
  directionsUrl: string; // Ready for directions navigation
  icon?: string | null;
  photos?: Array<{
    photoReference: string;
    width: number;
    height: number;
    attributions: string[];
  }>;
  attribution?: string;
}

export interface HospitalDetailsDto extends NormalizedHospitalDto {
  formattedAddress: string;
  formattedPhone?: string | null;
  internationalPhone?: string | null;
  openingHours?: {
    openNow?: boolean | null;
    weekdayText?: string[];
  };
  editorialSummary?: string | null;
  url?: string | null;
}

// Backward compatibility alias for legacy response shapes
export type HospitalResponseDto = NormalizedHospitalDto;

export interface SearchHospitalsQueryDto {
  q?: string;
  query?: string;
  search?: string;
  city?: string;
  speciality?: string;
  type?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  radiusKm?: number | string;
  radius?: number | string;
  sort?: FacilitySortOption | string;
  page?: number | string;
  limit?: number | string;
}

export interface GetEmergencyHospitalsQueryDto {
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  radius?: number | string;
  radiusKm?: number | string;
  city?: string;
  page?: number | string;
  limit?: number | string;
}

export interface NearbyHospitalsResponseDto {
  provider: 'google' | 'mock' | 'osm';
  count: number;
  searchRadiusKm: number;
  distanceCalculation: 'geodesic_haversine';
  attribution?: string;
  disclaimer?: string;
  warning?: string;
  hospitals: NormalizedHospitalDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
    nextPageToken?: string | null;
  };
}
