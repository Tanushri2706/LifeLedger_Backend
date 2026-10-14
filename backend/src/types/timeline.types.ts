import { Types } from 'mongoose';
import { ISubjectContextDto } from './medicalReport.types';

export enum TimelineEventType {
  REPORT_UPLOADED = 'report_uploaded',
  AI_ANALYSIS = 'ai_analysis',
  DIAGNOSIS_RECORDED = 'diagnosis_recorded',
  MEDICATION_PRESCRIBED = 'medication_prescribed',
  VITAL_CHECK = 'vital_check',
  GENERAL = 'general'
}

export type TimelineSourceType = 'medical_report' | 'ai_analysis' | 'manual_record' | 'other';

export interface ITimelineMetadata {
  category?: string;
  reportType?: string;
  riskLevel?: string;
  healthScore?: number;
  doctor?: string;
  hospital?: string;
  tags?: string[];
  findingsCount?: number;
  fileUrl?: string;
  thumbnailUrl?: string;
  [key: string]: unknown;
}

export interface ITimelineEvent {
  userId: Types.ObjectId;
  ownerUserId?: Types.ObjectId;
  subjectType?: 'user' | 'family_member';
  subjectId?: Types.ObjectId;
  eventType: TimelineEventType;
  title: string;
  description: string;
  date: Date;
  relatedReport?: Types.ObjectId;
  sourceType: TimelineSourceType;
  sourceId: string;
  metadata?: ITimelineMetadata;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTimelineEventDto {
  userId: string | Types.ObjectId;
  ownerUserId?: string | Types.ObjectId;
  subjectType?: 'user' | 'family_member';
  subjectId?: string | Types.ObjectId;
  eventType: TimelineEventType;
  title: string;
  description: string;
  date?: Date | string;
  relatedReport?: string | Types.ObjectId;
  sourceType?: TimelineSourceType;
  sourceId: string;
  metadata?: ITimelineMetadata;
}

export interface GetTimelineQueryDto {
  page?: string | number;
  limit?: string | number;
  eventType?: TimelineEventType;
  startDate?: string;
  endDate?: string;
  search?: string;
  subjectType?: 'user' | 'family_member' | string;
  subjectId?: string;
}

export interface TimelineEventResponseDto {
  id: string;
  eventType: TimelineEventType;
  title: string;
  description: string;
  date: Date;
  relatedReport?: string;
  sourceType: TimelineSourceType;
  sourceId: string;
  metadata?: ITimelineMetadata;
  subject?: ISubjectContextDto;
  createdAt: Date;
}
