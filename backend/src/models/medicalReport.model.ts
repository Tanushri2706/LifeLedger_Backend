import { Schema, model, Document, Model, Types } from 'mongoose';
import { ReportCategory, ProcessingStatus } from '../types';

export interface IMedicalReport {
  userId: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  subjectType: 'user' | 'family_member';
  subjectId: Types.ObjectId;
  title: string;
  category: ReportCategory;
  reportType?: string;
  hospital?: string;
  doctor?: string;
  reportDate: Date;
  fileUrl: string;
  publicId: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize: number;
  originalFilename: string;
  mimeType: string;
  resourceType?: string;
  deliveryType?: string;
  format?: string;
  processingStatus: ProcessingStatus;
  ocrText?: string;
  aiSummary?: string;
  healthScore?: number;
  riskLevel?: string;
  healthStory?: string;
  timelineGenerated: boolean;
  analysisResult?: import('../types').IStructuredReportAnalysis;
  analyzedAt?: Date;
  analysisModel?: string;
  analysisProvider?: string;
  errorMessage?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MedicalReportDocument = Document & IMedicalReport;

const medicalReportSchema = new Schema<MedicalReportDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for medical report'],
      index: true
    },
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: function () {
        return this.userId;
      },
      index: true
    },
    subjectType: {
      type: String,
      enum: ['user', 'family_member'],
      default: 'user',
      index: true
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      default: function () {
        return this.ownerUserId || this.userId;
      },
      index: true
    },
    title: {
      type: String,
      required: [true, 'Report title is required'],
      trim: true,
      maxlength: [200, 'Report title cannot exceed 200 characters']
    },
    category: {
      type: String,
      required: [true, 'Report category is required'],
      enum: {
        values: Object.values(ReportCategory),
        message: '{VALUE} is not a valid medical report category'
      },
      default: ReportCategory.OTHER,
      index: true
    },
    reportType: {
      type: String,
      trim: true
    },
    hospital: {
      type: String,
      trim: true
    },
    doctor: {
      type: String,
      trim: true
    },
    reportDate: {
      type: Date,
      default: Date.now,
      index: true
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      trim: true
    },
    publicId: {
      type: String,
      required: [true, 'Storage public ID is required'],
      trim: true
    },
    thumbnailUrl: {
      type: String,
      trim: true
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      trim: true
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [0, 'File size cannot be negative']
    },
    originalFilename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true
    },
    resourceType: {
      type: String,
      trim: true
    },
    deliveryType: {
      type: String,
      trim: true
    },
    format: {
      type: String,
      trim: true
    },
    processingStatus: {
      type: String,
      enum: {
        values: Object.values(ProcessingStatus),
        message: '{VALUE} is not a valid processing status'
      },
      default: ProcessingStatus.PENDING
    },
    ocrText: {
      type: String
    },
    aiSummary: {
      type: String
    },
    healthScore: {
      type: Number,
      min: [0, 'Health score cannot be negative'],
      max: [100, 'Health score cannot exceed 100']
    },
    riskLevel: {
      type: String,
      trim: true
    },
    healthStory: {
      type: String
    },
    timelineGenerated: {
      type: Boolean,
      default: false
    },
    analysisResult: {
      type: Schema.Types.Mixed
    },
    analyzedAt: {
      type: Date
    },
    analysisModel: {
      type: String,
      trim: true
    },
    analysisProvider: {
      type: String,
      trim: true
    },
    errorMessage: {
      type: String,
      trim: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for user query, subject queries, and dashboard filtering
medicalReportSchema.index({ ownerUserId: 1, subjectId: 1, reportDate: -1 });
medicalReportSchema.index({ ownerUserId: 1, subjectType: 1, isDeleted: 1 });
medicalReportSchema.index({ ownerUserId: 1, isDeleted: 1 });
medicalReportSchema.index({ userId: 1, reportDate: -1 });
medicalReportSchema.index({ userId: 1, category: 1 });
medicalReportSchema.index({ userId: 1, isDeleted: 1 });

export const MedicalReport: Model<MedicalReportDocument> = model<MedicalReportDocument>(
  'MedicalReport',
  medicalReportSchema,
  'medicalReports'
);
