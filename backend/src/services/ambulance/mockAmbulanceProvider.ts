import { IAmbulanceProvider, INearbyAmbulanceQuery, IAmbulanceResult } from './ambulanceProvider.interface';
import { AmbulanceType, AmbulanceStatus, IAmbulanceCapabilities, INDIA_EMERGENCY_NUMBERS } from '../../types';
import { calculateHaversineDistanceMeters } from '../location';

export const MOCK_AMBULANCE_UNITS: Omit<IAmbulanceResult, 'distance'>[] = [
  {
    id: 'mock_amb_001',
    hospitalId: 'mock_hosp_001',
    hospitalName: 'Apollo Multispeciality Hospital',
    vehicleNumber: 'TN-01-EM-1008',
    type: AmbulanceType.ADVANCED,
    driverName: 'R. Senthil',
    driverPhone: '+91 98400 11223',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [80.2525, 13.061] // [lng, lat] near Greams Road, Chennai
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 44 2829 0200'
  },
  {
    id: 'mock_amb_002',
    hospitalId: 'mock_hosp_001',
    hospitalName: 'Apollo Multispeciality Hospital',
    vehicleNumber: 'TN-01-EM-1009',
    type: AmbulanceType.BASIC,
    driverName: 'M. Kumar',
    driverPhone: '+91 98400 44556',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [80.2505, 13.0595]
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 44 2829 0200'
  },
  {
    id: 'mock_amb_003',
    hospitalId: 'mock_hosp_002',
    hospitalName: 'Fortis Memorial Health Institute',
    vehicleNumber: 'HR-26-EM-5511',
    type: AmbulanceType.ADVANCED,
    driverName: 'Rajinder Singh',
    driverPhone: '+91 98111 22334',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [77.0735, 28.4602] // Gurugram
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 124 4962200'
  },
  {
    id: 'mock_amb_004',
    hospitalId: 'mock_hosp_002',
    hospitalName: 'Fortis Memorial Health Institute',
    vehicleNumber: 'HR-26-EM-5512',
    type: AmbulanceType.NEONATAL,
    driverName: 'Amit Sharma',
    driverPhone: '+91 98111 55667',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [77.0715, 28.4585]
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 124 4962200'
  },
  {
    id: 'mock_amb_005',
    hospitalId: 'mock_clinic_003',
    hospitalName: 'Delhi Central Emergency Response',
    vehicleNumber: 'DL-01-EM-3321',
    type: AmbulanceType.BASIC,
    driverName: 'Deepak Verma',
    driverPhone: '+91 98100 77889',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [77.2175, 28.6335] // Connaught Place, New Delhi
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 11 2341 5500'
  },
  {
    id: 'mock_amb_006',
    hospitalId: 'mock_diag_004',
    hospitalName: 'Bengaluru Quick Rescue Network',
    vehicleNumber: 'KA-01-EM-9944',
    type: AmbulanceType.ADVANCED,
    driverName: 'Venkatesh Rao',
    driverPhone: '+91 98450 33445',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [77.642, 12.979] // Indiranagar, Bengaluru
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 80 4123 7890'
  },
  {
    id: 'mock_amb_007',
    hospitalId: 'mock_pharm_005',
    hospitalName: 'Mumbai West Ambulance Corps',
    vehicleNumber: 'MH-02-EM-7788',
    type: AmbulanceType.PATIENT_TRANSPORT,
    driverName: 'Sanjay Patil',
    driverPhone: '+91 98200 66778',
    status: AmbulanceStatus.AVAILABLE,
    currentLocation: {
      type: 'Point',
      coordinates: [72.834, 19.0605] // Bandra, Mumbai
    },
    isMock: true,
    dataSource: 'mock_provider',
    isLiveTracking: false,
    operatingHours: '24/7',
    contactNumber: '+91 22 2640 1234'
  }
];

export class MockAmbulanceProvider implements IAmbulanceProvider {
  public readonly name: string = 'mock_provider';
  public readonly isRealProvider: boolean = false;

  public getCapabilities(): IAmbulanceCapabilities {
    return {
      emergencyCallingAvailable: true,
      nearbyHospitalsAvailable: true,
      ambulanceDiscoveryAvailable: false, // Explicitly false in terms of real live discovery
      ambulanceDispatchAvailable: false,  // Explicitly false: no automated dispatch
      liveTrackingAvailable: false,       // Explicitly false: no GPS telemetry
      etaAvailable: false,                // Explicitly false: no ETA estimation
      isRealProvider: false,
      providerName: 'mock_provider',
      emergencyNumbers: {
        ambulance: INDIA_EMERGENCY_NUMBERS.AMBULANCE.number,
        nationalEmergency: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.number
      },
      disclaimer:
        'Development/Mock ambulance provider active. No real ambulance fleet connection is present. For urgent medical emergencies, call 108 or 112 directly.'
    };
  }

  public async searchNearby(query: INearbyAmbulanceQuery): Promise<IAmbulanceResult[]> {
    const { latitude, longitude, radius = 50000, type, status, limit = 20 } = query;

    let results: IAmbulanceResult[] = MOCK_AMBULANCE_UNITS.map((unit) => {
      let distance: number | undefined;
      if (latitude !== undefined && longitude !== undefined) {
        distance = calculateHaversineDistanceMeters(
          latitude,
          longitude,
          unit.currentLocation.coordinates[1],
          unit.currentLocation.coordinates[0]
        );
      }
      return {
        ...unit,
        distance
      };
    });

    if (type && type !== 'all') {
      results = results.filter((u) => u.type.toLowerCase() === String(type).toLowerCase());
    }

    if (status && status !== 'all') {
      results = results.filter((u) => u.status.toLowerCase() === String(status).toLowerCase());
    }

    if (radius && radius > 0 && latitude !== undefined && longitude !== undefined) {
      results = results.filter((u) => (u.distance ?? 0) <= radius);
    }

    if (latitude !== undefined && longitude !== undefined) {
      results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
    }

    return results.slice(0, limit);
  }

  public async getAmbulanceById(id: string): Promise<IAmbulanceResult | null> {
    const unit = MOCK_AMBULANCE_UNITS.find((u) => u.id === id);
    return unit ? { ...unit } : null;
  }
}

