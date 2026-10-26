import { Types } from 'mongoose';
import { ISubjectContextDto } from './medicalReport.types';

// ============================================================================
// 1. MEDICAL SHARE ENUMS & TYPES
// ============================================================================

export type MedicalShareAccessMode = 'one_time' | 'time_limited';
export type MedicalShareStatus = 'active' | 'consumed' | 'revoked' | 'expired';

// ============================================================================
// 2. MEDICAL SHARE MODEL INTERFACE
// ============================================================================

export interface IMedicalShare {
  id?: string;
  _id?: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  subjectType: 'user' | 'family_member';
  subjectId: Types.ObjectId;
  selectedReportIds: Types.ObjectId[];
  tokenHash: string;
  accessMode: MedicalShareAccessMode;
  expiresAt: Date;
  status: MedicalShareStatus;
  consumedAt?: Date | null;
  revokedAt?: Date | null;
  lastAccessedAt?: Date | null;
  accessCount: number;
  activeSessionTokenHash?: string | null;
  sessionExpiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// 3. DTO CONTRACTS (OWNER)
// ============================================================================

export interface CreateMedicalShareDto {
  subjectType?: 'user' | 'family_member';
  subjectId?: string;
  reportIds: string[];
  accessMode?: MedicalShareAccessMode;
  expiresInMinutes?: number;
}

export interface MedicalShareCreatedResponseDto {
  shareId: string;
  rawToken: string;
  shareUrl: string;
  subject: ISubjectContextDto;
  selectedReportCount: number;
  accessMode: MedicalShareAccessMode;
  expiresAt: Date;
  status: MedicalShareStatus;
  createdAt: Date;
}

export interface SharedReportSummaryDto {
  id: string;
  title: string;
  category: string;
  reportType?: string;
  reportDate: Date;
  fileType: string;
  mimeType: string;
  fileSize: number;
  originalFilename: string;
}

export interface MedicalShareOwnerResponseDto {
  id: string;
  subject: ISubjectContextDto;
  reportCount: number;
  selectedReports?: SharedReportSummaryDto[];
  accessMode: MedicalShareAccessMode;
  status: MedicalShareStatus;
  expiresAt: Date;
  consumedAt?: Date | null;
  revokedAt?: Date | null;
  lastAccessedAt?: Date | null;
  accessCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// 4. DTO CONTRACTS (PUBLIC RECIPIENT)
// ============================================================================

export interface PublicMedicalShareMetadataDto {
  shareId: string;
  subjectDisplayName: string;
  reportCount: number;
  accessMode: MedicalShareAccessMode;
  expiresAt: Date;
  status: MedicalShareStatus;
  isReadyForAccess: boolean;
}

export interface PublicMedicalShareAccessSessionDto {
  sessionToken: string;
  sessionExpiresAt: Date;
  subjectDisplayName: string;
  reports: SharedReportSummaryDto[];
}

export interface PublicMedicalShareDocumentDownloadDto {
  downloadUrl: string;
  originalFilename: string;
  fileName?: string;
  mimeType: string;
  fileSize: number;
}
