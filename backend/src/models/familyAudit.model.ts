import { Schema, model, Document, Model } from 'mongoose';
import { IFamilyAuditRecord, FamilyAuditAction } from '../types';

export type FamilyAuditDocument = Document & IFamilyAuditRecord;

const familyAuditSchema = new Schema<FamilyAuditDocument>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor user ID is required for audit event'],
      index: true
    },
    familyMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'FamilyMember',
      required: [true, 'Target family member ID is required for audit event'],
      index: true
    },
    action: {
      type: String,
      enum: {
        values: Object.values(FamilyAuditAction),
        message: '{VALUE} is not a valid family audit action'
      },
      required: [true, 'Audit action is required'],
      index: true
    },
    details: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

familyAuditSchema.index({ actorUserId: 1, createdAt: -1 });
familyAuditSchema.index({ familyMemberId: 1, createdAt: -1 });

export const FamilyAudit: Model<FamilyAuditDocument> = model<FamilyAuditDocument>(
  'FamilyAudit',
  familyAuditSchema,
  'familyAudits'
);
