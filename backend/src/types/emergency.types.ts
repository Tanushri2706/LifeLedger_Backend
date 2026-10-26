import { Types } from 'mongoose';
import { BloodGroup, IEmergencyContact } from './models.types';
import { AmbulanceType } from './ambulance.types';

// ============================================================================
// 1. INDIA EMERGENCY HELPLINE NUMBERS (CANONICAL & CENTRALIZED)
// ============================================================================

export const INDIA_EMERGENCY_NUMBERS = {
  NATIONAL_EMERGENCY: {
    number: '112',
    name: 'National Emergency Helpline (Unified)',
    description: 'Single all-India emergency response number for Police, Fire, and Medical emergencies.',
    actionUrl: 'tel:112',
    priority: 'critical' as const,
    telephonyOnly: true
  },
  AMBULANCE: {
    number: '108',
    name: 'Ambulance / Emergency Medical Response',
    description: 'Emergency medical response and ambulance dispatch service in participating Indian states/UTs.',
    actionUrl: 'tel:108',
    priority: 'critical' as const,
    telephonyOnly: true,
    regionalNote: 'Operational in supported Indian states/UTs. In areas where 108 is unavailable or unreachable, dial 112.'
  }
} as const;

// ============================================================================
// 2. EMERGENCY CONTACT DTOS
// ============================================================================

export interface CreateEmergencyContactDto {
  name: string;
  relationship: string;
  phone: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface UpdateEmergencyContactDto {
  name?: string;
  relationship?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
}

// ============================================================================
// 3. EMERGENCY PROFILE & INFORMATION
// ============================================================================

export interface IEmergencyInfo {
  userId: string;
  userName?: string;
  bloodGroup?: BloodGroup;
  allergies: string[];
  medicalConditions: string[];
  criticalNotes?: string;
  emergencyContacts: IEmergencyContact[];
  lastUpdated?: Date;
}

export interface UpdateEmergencyInfoDto {
  bloodGroup?: BloodGroup;
  allergies?: string[];
  medicalConditions?: string[];
  criticalNotes?: string;
}

// ============================================================================
// 4. EMERGENCY QR & PUBLIC SCANNER CONTRACT
// ============================================================================

export interface IEmergencyQR {
  id?: string;
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  qrToken: string;
  qrCode: string;
  bloodGroup?: BloodGroup;
  allergies?: string[];
  medicalConditions?: string[];
  criticalNotes?: string;
  emergencyContacts?: IEmergencyContact[];
  isActive: boolean;
  lastAccessedAt?: Date;
  accessCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IPublicEmergencyInfo {
  userName: string;
  bloodGroup?: BloodGroup;
  allergies: string[];
  medicalConditions: string[];
  criticalNotes?: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
    isPrimary?: boolean;
  }>;
  verifiedAt: Date;
  disclaimer: string;
}

// ============================================================================
// 5. EMERGENCY ACTIONS & METADATA
// ============================================================================

export enum EmergencyActionType {
  CALL_NATIONAL_EMERGENCY = 'call_national_emergency',
  CALL_AMBULANCE = 'call_ambulance',
  HOSPITAL_DIRECTIONS = 'hospital_directions',
  NOTIFY_CONTACTS = 'notify_contacts',
  TRIGGER_SOS = 'trigger_sos'
}

export interface IEmergencyActionMetadata {
  type: EmergencyActionType;
  title: string;
  description: string;
  actionUrl?: string;
  phoneNumber?: string;
  priority: 'critical' | 'high' | 'standard';
  isRealtimeDispatch: boolean;
  status: 'available' | 'external_telephony' | 'mock_simulation';
  disclaimer?: string;
  regionalNote?: string;
}

// ============================================================================
// 6. SOS RECORD & PAYLOAD
// ============================================================================

export enum SOSStatus {
  TRIGGERED = 'triggered',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled'
}

export interface TriggerSOSDto {
  latitude?: number;
  longitude?: number;
  notes?: string;
  batteryLevel?: number;
  networkStatus?: string;
}

export interface ISOSRecord {
  id?: string;
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  status: SOSStatus;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  notes?: string;
  contactsNotifiedCount: number;
  dispatchedRealEmergency: boolean;
  disclaimer: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TriggerSOSResponseDto {
  sosRecord: ISOSRecord;
  emergencyNumbers: {
    nationalEmergency: string;
    ambulance: string;
  };
  capabilities: IEmergencyCapabilities;
  instructions: string[];
}

export interface ShareEmergencyPayloadDto {
  recipientEmail?: string;
  recipientPhone?: string;
  message?: string;
  includeVitals?: boolean;
  latitude?: number;
  longitude?: number;
}

// ============================================================================
// 7. EMERGENCY CAPABILITIES & REAL-WORLD CONTRACT
// ============================================================================

export interface IEmergencyCapabilities {
  emergencyCallingAvailable: boolean;
  nearbyHospitalsAvailable: boolean;
  ambulanceDiscoveryAvailable: boolean;
  ambulanceDispatchAvailable: boolean;
  liveTrackingAvailable: boolean;
  etaAvailable: boolean;
  providerStatus: {
    locationProvider: 'google' | 'mock' | 'osm';
    ambulanceProvider: 'mock_provider' | 'none' | 'live_provider';
    isRealAmbulanceProvider: boolean;
  };
  emergencyNumbers: {
    nationalEmergency: string;
    ambulance: string;
  };
  disclaimer: string;
}

export interface IAmbulanceTypeSpec {
  type: AmbulanceType;
  name: string;
  description: string;
  equipment: string[];
  suitableFor: string;
  dispatchNotice: string;
}

