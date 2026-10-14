export interface ILocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface INearbyPlacesQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number; // Distance in meters (100 to 50,000 meters max)
  type?: string; // 'hospital', 'clinic', 'pharmacy', 'diagnostic_center', 'blood_bank', 'all'
  keyword?: string;
  openNow?: boolean;
  minRating?: number;
  sort?: 'distance' | 'rating' | 'relevance';
  limit?: number;
  pageToken?: string;
}

export interface IPlaceResult {
  placeId: string;
  name: string;
  type: string;
  types: string[];
  address: string;
  vicinity?: string;
  formattedAddress?: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  latitude: number;
  longitude: number;
  distanceMeters?: number; // Geodesic distance in meters from query coordinates
  distanceKm?: number; // Geodesic distance in km
  rating: number | null; // Real rating or null
  reviewCount: number; // Real review count
  userRatingsTotal: number;
  phone?: string | null;
  internationalPhone?: string | null;
  website?: string | null;
  openNow?: boolean | null;
  businessStatus?: string | null;
  googleMapsUrl: string;
  directionsUrl: string;
  icon?: string | null;
  photos?: Array<{
    photoReference: string;
    width: number;
    height: number;
    attributions: string[];
  }>;
  openingHours?: {
    openNow?: boolean | null;
    weekdayText?: string[];
  };
  editorialSummary?: string | null;
  attribution?: string;
}

export interface INearbyPlacesResult {
  provider: 'google' | 'mock' | 'osm';
  places: IPlaceResult[];
  totalReturned: number;
  nextPageToken?: string | null;
  attribution?: string;
}

export interface IGeocodeResult {
  formattedAddress: string;
  location: ILocationCoordinates;
  placeId?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface ILocationProvider {
  readonly providerName: 'google' | 'mock' | 'osm';
  searchNearby(query: INearbyPlacesQuery): Promise<INearbyPlacesResult>;
  getPlaceDetails(placeId: string): Promise<IPlaceResult | null>;
  geocode(address: string): Promise<IGeocodeResult | null>;
}
