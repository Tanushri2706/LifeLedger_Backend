import { Types, PipelineStage } from 'mongoose';
import { Ambulance, AmbulanceDocument, Hospital } from '../models';
import {
  AmbulanceType,
  AmbulanceStatus,
  AmbulanceResponseDto,
  AmbulanceListResponseDto,
  GetNearbyAmbulancesQueryDto,
  IAmbulanceCapabilities,
  IAmbulanceTypeSpec,
  INDIA_EMERGENCY_NUMBERS
} from '../types';
import { AppError } from '../utils';
import { createAmbulanceProvider, IAmbulanceProvider, MOCK_AMBULANCE_UNITS } from './ambulance';

export const SUPPORTED_AMBULANCE_TYPES: IAmbulanceTypeSpec[] = [
  {
    type: AmbulanceType.BASIC,
    name: 'Basic Life Support (BLS)',
    description:
      'Equipped for non-critical patient transport with basic medical monitoring, oxygen delivery, and first-aid capabilities.',
    equipment: [
      'Oxygen Cylinder & Flowmeter',
      'Standard Multi-position Stretcher',
      'Blood Pressure & SpO2 Monitor',
      'Emergency First-Aid Kit & Splints'
    ],
    suitableFor: 'Non-life-threatening conditions, stable inter-hospital transfers, limb fractures.',
    dispatchNotice:
      'Dial 108 or hospital transport desk directly. LifeLedger provides contact & routing metadata without automated vehicle dispatch.'
  },
  {
    type: AmbulanceType.ADVANCED,
    name: 'Advanced Cardiac Life Support (ACLS)',
    description:
      'Mobile intensive care unit equipped with cardiac defibrillators, transport ventilators, and emergency medication for life-threatening crises.',
    equipment: [
      'Defibrillator / AED with ECG Monitor',
      'Transport Ventilator & Suction Apparatus',
      'Emergency Resuscitation & Cardiac Drugs',
      'Advanced Airway Management Kit'
    ],
    suitableFor: 'Acute myocardial infarction, respiratory failure, severe trauma, stroke, critical ICU transfers.',
    dispatchNotice:
      'Dial 108 or 112 immediately for life-threatening emergencies. Do not delay emergency calls.'
  },
  {
    type: AmbulanceType.PATIENT_TRANSPORT,
    name: 'Patient Transport Vehicle (PTV)',
    description:
      'Specialized vehicle designed for planned medical transit, mobility-assisted patients, and non-emergency appointments.',
    equipment: [
      'Wheelchair Ramp / Assisted Lift',
      'Comfort Stretcher',
      'Basic Vital Signs Kit',
      'Attendant Seating'
    ],
    suitableFor: 'Scheduled dialysis appointments, chemotherapy visits, post-discharge home transit.',
    dispatchNotice:
      'Book in advance by contacting hospital dispatch desk. LifeLedger does not perform automated booking.'
  },
  {
    type: AmbulanceType.NEONATAL,
    name: 'Neonatal Intensive Care Unit (NICU)',
    description:
      'Highly specialized emergency incubator vehicle designed for the safe transport of critically ill or premature neonates.',
    equipment: [
      'Temperature-controlled Transport Incubator',
      'Neonatal Resuscitation & Micro-ventilator',
      'Micro-infusion Syringe Pumps',
      'Neonatal Multi-parameter Monitor'
    ],
    suitableFor: 'Premature newborns, neonatal respiratory distress, tertiary pediatric transfers.',
    dispatchNotice:
      'Requires institutional hospital-to-hospital coordination with pediatric team. Dial hospital emergency desk.'
  }
];

export class AmbulanceService {
  private ambulanceProvider: IAmbulanceProvider;

  constructor() {
    this.ambulanceProvider = createAmbulanceProvider();
  }

  public getAmbulanceProvider(): IAmbulanceProvider {
    return this.ambulanceProvider;
  }

  public getCapabilities(): IAmbulanceCapabilities {
    return {
      emergencyCallingAvailable: true,
      nearbyHospitalsAvailable: true,
      ambulanceDiscoveryAvailable: false, // Explicitly false for live fleet telemetry
      ambulanceDispatchAvailable: false,  // Explicitly false: no automated dispatch
      liveTrackingAvailable: false,       // Explicitly false: no live GPS tracking
      etaAvailable: false,                // Explicitly false: no fake ETA calculations
      isRealProvider: false,
      providerName: 'mock_provider',
      emergencyNumbers: {
        ambulance: INDIA_EMERGENCY_NUMBERS.AMBULANCE.number,
        nationalEmergency: INDIA_EMERGENCY_NUMBERS.NATIONAL_EMERGENCY.number
      },
      disclaimer:
        'Live ambulance fleet telematics is not connected. Vehicles shown in development mode are simulated facility records. For immediate medical emergency transport, call 108 or 112 directly.'
    };
  }

  public getSupportedTypes(): { types: IAmbulanceTypeSpec[]; count: number } {
    return {
      types: SUPPORTED_AMBULANCE_TYPES,
      count: SUPPORTED_AMBULANCE_TYPES.length
    };
  }

  public async seedDefaultAmbulancesIfEmpty(): Promise<void> {
    const count = await Ambulance.countDocuments({ isDeleted: false });
    if (count === 0) {
      // Look up existing hospitals to link if available
      const hospitals = await Hospital.find({ isDeleted: false }).limit(10);
      const hospitalMap: Record<string, Types.ObjectId> = {};
      hospitals.forEach((h) => {
        hospitalMap[h.name.toLowerCase()] = h._id as Types.ObjectId;
      });

      const documents = MOCK_AMBULANCE_UNITS.map((unit) => {
        let matchedHospitalId: Types.ObjectId | undefined;
        if (unit.hospitalName) {
          const key = unit.hospitalName.toLowerCase();
          for (const [name, id] of Object.entries(hospitalMap)) {
            if (key.includes(name) || name.includes(key)) {
              matchedHospitalId = id;
              break;
            }
          }
        }

        return {
          hospitalId: matchedHospitalId,
          hospitalName: unit.hospitalName,
          vehicleNumber: unit.vehicleNumber,
          type: unit.type,
          driverName: unit.driverName,
          driverPhone: unit.driverPhone,
          status: unit.status,
          currentLocation: unit.currentLocation,
          baseStationAddress: unit.hospitalName,
          isVerified: true,
          isDeleted: false
        };
      });

      await Ambulance.insertMany(documents);
    }
  }

  private mapDocumentToDto(
    doc: (AmbulanceDocument | Record<string, any>) & { distance?: number }
  ): AmbulanceResponseDto {
    const json = typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
    return {
      id: json._id ? json._id.toString() : String(doc._id || json.id),
      hospitalId: json.hospitalId ? json.hospitalId.toString() : undefined,
      hospitalName: json.hospitalName,
      vehicleNumber: json.vehicleNumber,
      type: json.type,
      driverName: json.driverName,
      driverPhone: json.driverPhone,
      status: json.status,
      currentLocation: json.currentLocation,
      distance:
        typeof doc.distance === 'number'
          ? Math.round(doc.distance)
          : undefined,
      isMock: true,
      dataSource: 'database',
      isLiveTracking: false,
      operatingHours: '24/7',
      contactNumber: json.driverPhone,
      createdAt: json.createdAt
    };
  }

  public async getNearbyAmbulances(query: GetNearbyAmbulancesQueryDto): Promise<AmbulanceListResponseDto> {
    await this.seedDefaultAmbulancesIfEmpty();

    const rawLat = query.latitude ?? query.lat;
    const rawLng = query.longitude ?? query.lng;

    let latitude: number | undefined;
    let longitude: number | undefined;

    if (rawLat !== undefined || rawLng !== undefined) {
      if (rawLat === undefined || rawLng === undefined) {
        throw new AppError('Both latitude and longitude must be provided for location discovery', 400);
      }

      latitude = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
      longitude = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        throw new AppError('Latitude must be a valid number between -90 and 90', 400);
      }

      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        throw new AppError('Longitude must be a valid number between -180 and 180', 400);
      }
    }

    let radius = 50000; // 50km default for ambulance coverage
    if (query.radius !== undefined) {
      const parsedRadius =
        typeof query.radius === 'number' ? query.radius : parseFloat(String(query.radius));
      if (isNaN(parsedRadius) || parsedRadius < 100 || parsedRadius > 200000) {
        throw new AppError('Radius must be a number between 100 meters and 200,000 meters (200km)', 400);
      }
      radius = parsedRadius;
    }

    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit), 10) || 10));
    const skip = (page - 1) * limit;

    const matchConditions: Record<string, unknown> = { isDeleted: false };

    if (query.type && query.type !== 'all') {
      const typeLower = String(query.type).toLowerCase().trim();
      const validTypes = Object.values(AmbulanceType).map((v) => v.toLowerCase());
      if (validTypes.includes(typeLower)) {
        matchConditions.type = typeLower;
      }
    }

    if (query.status && query.status !== 'all') {
      const statusLower = String(query.status).toLowerCase().trim();
      const validStatuses = Object.values(AmbulanceStatus).map((v) => v.toLowerCase());
      if (validStatuses.includes(statusLower)) {
        matchConditions.status = statusLower;
      }
    }

    if (query.city && query.city.trim()) {
      matchConditions.city = { $regex: new RegExp(query.city.trim(), 'i') };
    }

    const capabilities = this.getCapabilities();

    // 1. Geospatial Query with $geoNear when coordinates are provided
    if (latitude !== undefined && longitude !== undefined) {
      const geoNearStage: PipelineStage = {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude] as [number, number]
          },
          distanceField: 'distance',
          maxDistance: radius,
          spherical: true,
          query: matchConditions
        }
      };

      const queryPipeline: PipelineStage[] = [
        geoNearStage,
        { $sort: { distance: 1 } },
        { $skip: skip },
        { $limit: limit }
      ];

      const countPipeline: PipelineStage[] = [
        geoNearStage,
        { $count: 'total' }
      ];

      const [geoResults, countResults] = await Promise.all([
        Ambulance.aggregate(queryPipeline),
        Ambulance.aggregate(countPipeline)
      ]);

      const total = countResults.length > 0 ? (countResults[0] as { total: number }).total : 0;
      const totalPages = Math.ceil(total / limit) || 1;

      return {
        ambulances: geoResults.map((doc) => this.mapDocumentToDto(doc)),
        capabilities,
        pagination: {
          total,
          page,
          limit,
          totalPages
        }
      };
    }

    // 2. Standard Search / List Query when coordinates are not provided
    const [total, documents] = await Promise.all([
      Ambulance.countDocuments(matchConditions),
      Ambulance.find(matchConditions)
        .sort({ status: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      ambulances: documents.map((doc) => this.mapDocumentToDto(doc)),
      capabilities,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  public async getAmbulanceById(id: string): Promise<{ ambulance: AmbulanceResponseDto; capabilities: IAmbulanceCapabilities }> {
    const capabilities = this.getCapabilities();

    if (!Types.ObjectId.isValid(id)) {
      // Fallback check in mock provider
      const mockResult = await this.ambulanceProvider.getAmbulanceById(id);
      if (mockResult) {
        return {
          ambulance: {
            ...mockResult,
            distance: undefined
          },
          capabilities
        };
      }
      throw new AppError('Ambulance not found', 404);
    }

    const ambulance = await Ambulance.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false
    });

    if (!ambulance) {
      throw new AppError('Ambulance not found', 404);
    }

    return {
      ambulance: this.mapDocumentToDto(ambulance),
      capabilities
    };
  }
}

export const ambulanceService: AmbulanceService = new AmbulanceService();



