import { Types } from 'mongoose';
import { BloodGroup, Gender } from './models.types';

// ============================================================================
// 1. FAMILY RELATIONSHIP & STATUS ENUMS
// ============================================================================

export enum FamilyRelationship {
  MOTHER = 'mother',
  FATHER = 'father',
  SPOUSE = 'spouse',
  SON = 'son',
  DAUGHTER = 'daughter',
  BROTHER = 'brother',
  SISTER = 'sister',
  GRANDMOTHER = 'grandmother',
  GRANDFATHER = 'grandfather',
  GUARDIAN = 'guardian',
  DEPENDENT = 'dependent',
  OTHER = 'other'
}

export enum FamilyMemberStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived'
}

// ============================================================================
// 2. MANAGED FAMILY PROFILE MODEL INTERFACE
// ============================================================================

export interface IFamilyMember {
  id?: string;
  _id?: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  displayName: string;
  relationship: FamilyRelationship;
  dateOfBirth?: Date;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  phone?: string;
  emergencyNotes?: string;
  allergies: string[];
  medicalConditions: string[];
  managementAuthorizationConfirmed: boolean;
  managementAuthorizationConfirmedAt?: Date | null;
  status: FamilyMemberStatus;
  archivedAt?: Date | null;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// 3. DTO CONTRACTS
// ============================================================================

export interface CreateFamilyMemberDto {
  displayName: string;
  relationship: FamilyRelationship;
  dateOfBirth?: string | Date;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  phone?: string;
  emergencyNotes?: string;
  allergies?: string[];
  medicalConditions?: string[];
  managementAuthorizationConfirmed?: boolean;
}

export interface UpdateFamilyMemberDto {
  displayName?: string;
  relationship?: FamilyRelationship;
  dateOfBirth?: string | Date | null;
  gender?: Gender | null;
  bloodGroup?: BloodGroup | null;
  phone?: string | null;
  emergencyNotes?: string | null;
  allergies?: string[];
  medicalConditions?: string[];
  managementAuthorizationConfirmed?: boolean;
}

export interface FamilyMemberResponseDto {
  id: string;
  displayName: string;
  relationship: FamilyRelationship;
  dateOfBirth?: Date | null;
  age?: number | null;
  gender?: Gender | null;
  bloodGroup?: BloodGroup | null;
  phone?: string | null;
  emergencyNotes?: string | null;
  allergies: string[];
  medicalConditions: string[];
  managementAuthorizationConfirmed: boolean;
  managementAuthorizationConfirmedAt?: Date | null;
  status: FamilyMemberStatus;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FamilyVaultSummaryDto {
  activeMemberCount: number;
  archivedMemberCount: number;
  totalMembers: number;
  relationshipsSummary: Record<string, number>;
}

// ============================================================================
// 4. FAMILY VAULT AUDITABILITY
// ============================================================================

export enum FamilyAuditAction {
  MEMBER_CREATED = 'family_member_created',
  MEMBER_UPDATED = 'family_member_updated',
  MEMBER_ARCHIVED = 'family_member_archived',
  MEMBER_RESTORED = 'family_member_restored',
  REPORT_UPLOADED = 'family_report_uploaded',
  REPORT_DELETED = 'family_report_deleted',
  AI_ANALYSIS_COMPLETED = 'family_ai_analysis_completed',
  MEDICAL_SHARE_CREATED = 'family_medical_share_created',
  MEDICAL_SHARE_REVOKED = 'family_medical_share_revoked',
  MEDICAL_SHARE_ACCESSED = 'family_medical_share_accessed'
}

export interface IFamilyAuditRecord {
  id?: string;
  _id?: Types.ObjectId;
  actorUserId: Types.ObjectId;
  familyMemberId: Types.ObjectId;
  action: FamilyAuditAction;
  details?: Record<string, unknown>;
  createdAt?: Date;
}

// ============================================================================
// 5. FUTURE-COMPATIBLE SUBJECT IDENTITY ARCHITECTURE (DOCUMENTATION CONTRACT)
// ============================================================================

export enum HealthSubjectType {
  USER = 'user',
  FAMILY_MEMBER = 'family_member'
}

export interface IHealthSubjectReference {
  subjectType: HealthSubjectType;
  subjectId: string;
  ownerUserId: string;
}
