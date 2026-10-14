import { Schema, model, Document, Model } from 'mongoose';
import { IMedicalShare } from '../types';

export type MedicalShareDocument = Document & IMedicalShare;

const medicalShareSchema = new Schema<MedicalShareDocument>(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner user ID is required for medical share'],
      index: true
    },
    subjectType: {
      type: String,
      enum: ['user', 'family_member'],
      required: [true, 'Subject type is required for medical share'],
      default: 'user',
      index: true
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Subject ID is required for medical share'],
      index: true
    },
    selectedReportIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'MedicalReport',
        required: true
      }
    ],
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required for medical share'],
      unique: true,
      index: true,
      trim: true
    },
    accessMode: {
      type: String,
      enum: ['one_time', 'time_limited'],
      required: [true, 'Access mode is required for medical share'],
      default: 'one_time'
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration timestamp is required for medical share'],
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'consumed', 'revoked', 'expired'],
      default: 'active',
      index: true
    },
    consumedAt: {
      type: Date
    },
    revokedAt: {
      type: Date
    },
    lastAccessedAt: {
      type: Date
    },
    accessCount: {
      type: Number,
      default: 0,
      min: [0, 'Access count cannot be negative']
    },
    activeSessionTokenHash: {
      type: String,
      trim: true
    },
    sessionExpiresAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for rapid owner queries, subject scoping, active cleanup, and session lookup
medicalShareSchema.index({ ownerUserId: 1, createdAt: -1 });
medicalShareSchema.index({ ownerUserId: 1, subjectId: 1 });
medicalShareSchema.index({ status: 1, expiresAt: 1 });
medicalShareSchema.index({ activeSessionTokenHash: 1 });

export const MedicalShare: Model<MedicalShareDocument> = model<MedicalShareDocument>(
  'MedicalShare',
  medicalShareSchema,
  'medicalShares'
);
