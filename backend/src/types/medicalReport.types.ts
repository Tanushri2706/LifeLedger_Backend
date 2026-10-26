export enum ReportCategory {
  BLOOD_REPORT = 'blood_report',
  LAB_REPORT = 'lab_report',
  LAB_TEST = 'lab_test',
  IMAGING_SCAN = 'imaging_scan',
  PRESCRIPTION = 'prescription',
  DISCHARGE_SUMMARY = 'discharge_summary',
  PATHOLOGY = 'pathology',
  INVOICE = 'invoice',
  VACCINATION = 'vaccination',
  OTHER = 'other'
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  UNREADABLE = 'unreadable'
}

export interface ISubjectContextDto {
  type: 'user' | 'family_member';
  id: string;
  displayName?: string;
  relationship?: string;
}

export interface UploadReportDto {
  title?: string;
  category?: ReportCategory | string;
  reportType?: string;
  hospital?: string;
  doctor?: string;
  reportDate?: string | Date;
  subjectType?: 'user' | 'family_member' | string;
  subjectId?: string;
}

export interface UpdateReportDto {
  title?: string;
  category?: ReportCategory | string;
  reportType?: string;
  hospital?: string;
  doctor?: string;
  reportDate?: string | Date;
}

export interface GetReportsQueryDto {
  page?: string | number;
  limit?: string | number;
  category?: ReportCategory;
  startDate?: string;
  endDate?: string;
  search?: string;
  subjectType?: 'user' | 'family_member' | string;
  subjectId?: string;
}

export interface MedicalReportResponseDto {
  id: string;
  title: string;
  category: ReportCategory;
  reportType?: string;
  hospital?: string;
  doctor?: string;
  reportDate: Date;
  fileUrl: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize: number;
  originalFilename: string;
  mimeType: string;
  processingStatus: ProcessingStatus;
  subject: ISubjectContextDto;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IStorageOptions {
  resourceType?: string;
  deliveryType?: string;
  format?: string;
  mimeType?: string;
}

export interface IStorageUploadResult {
  fileUrl: string;
  publicId: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
  fileType: string;
  originalFilename: string;
  resourceType?: string;
  deliveryType?: string;
  format?: string;
}

