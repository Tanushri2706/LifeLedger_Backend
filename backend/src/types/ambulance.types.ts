export enum AmbulanceType {
  BASIC = 'basic',
  ADVANCED = 'advanced',
  PATIENT_TRANSPORT = 'patient_transport',
  NEONATAL = 'neonatal'
}

export enum AmbulanceStatus {
  AVAILABLE = 'available',
  ON_DUTY = 'on_duty',
  MAINTENANCE = 'maintenance',
  OFFLINE = 'offline'
}

export interface IAmbulance {
  id?: string;
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
  baseStationAddress?: string;
  city?: string;
  state?: string;
  isVerified?: boolean;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AmbulanceResponseDto {
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
  createdAt?: Date;
}

export interface IAmbulanceCapabilities {
  emergencyCallingAvailable: boolean;
  nearbyHospitalsAvailable: boolean;
  ambulanceDiscoveryAvailable: boolean;
  ambulanceDispatchAvailable: boolean;
  liveTrackingAvailable: boolean;
  etaAvailable: boolean;
  isRealProvider: boolean;
  providerName: string;
  emergencyNumbers: {
    ambulance: string;
    nationalEmergency: string;
  };
  disclaimer: string;
}

export interface GetNearbyAmbulancesQueryDto {
  latitude?: number | string;
  lat?: number | string;
  longitude?: number | string;
  lng?: number | string;
  radius?: number | string; // meters
  type?: AmbulanceType | string;
  status?: AmbulanceStatus | string;
  city?: string;
  page?: number | string;
  limit?: number | string;
}

export interface AmbulanceListResponseDto {
  ambulances: AmbulanceResponseDto[];
  capabilities: IAmbulanceCapabilities;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

