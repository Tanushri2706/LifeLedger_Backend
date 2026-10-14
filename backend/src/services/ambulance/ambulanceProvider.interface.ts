import { AmbulanceType, AmbulanceStatus, IAmbulanceCapabilities } from '../../types';

export interface INearbyAmbulanceQuery {
  latitude: number;
  longitude: number;
  radius?: number; // Distance in meters (e.g. 50000)
  type?: AmbulanceType | string;
  status?: AmbulanceStatus | string;
  limit?: number;
}

export interface IAmbulanceResult {
  id: string;
  hospitalId?: string;
  hospitalName?: string;
  vehicleNumber?: string;
  type: AmbulanceType;
  driverName?: string;
  driverPhone?: string;
  status: AmbulanceStatus;
  currentLocation: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  distance?: number; // Straight-line distance in meters from query coordinates
  isMock: boolean;
  dataSource: 'database' | 'mock_provider' | 'live_provider';
  isLiveTracking: boolean;
  operatingHours?: string;
  contactNumber?: string;
}

export interface IAmbulanceProvider {
  readonly name: string;
  readonly isRealProvider: boolean;
  searchNearby(query: INearbyAmbulanceQuery): Promise<IAmbulanceResult[]>;
  getAmbulanceById(id: string): Promise<IAmbulanceResult | null>;
  getCapabilities(): IAmbulanceCapabilities;
}

