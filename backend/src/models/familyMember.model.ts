import { Schema, model, Document, Model } from 'mongoose';
import { IFamilyMember, FamilyRelationship, FamilyMemberStatus, BloodGroup, Gender } from '../types';

export type FamilyMemberDocument = Document & IFamilyMember;

const familyMemberSchema = new Schema<FamilyMemberDocument>(
  {
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Managing account owner User ID is required'],
      index: true
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required for managed family profile'],
      trim: true,
      minlength: [2, 'Display name must be at least 2 characters'],
      maxlength: [100, 'Display name cannot exceed 100 characters']
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      enum: {
        values: Object.values(FamilyRelationship),
        message: '{VALUE} is not a valid family relationship'
      },
      index: true
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: {
        values: Object.values(Gender),
        message: '{VALUE} is not a valid gender'
      }
    },
    bloodGroup: {
      type: String,
      enum: {
        values: Object.values(BloodGroup),
        message: '{VALUE} is not a valid blood group'
      }
    },
    phone: {
      type: String,
      trim: true
    },
    emergencyNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Emergency notes cannot exceed 500 characters']
    },
    allergies: {
      type: [String],
      default: []
    },
    medicalConditions: {
      type: [String],
      default: []
    },
    managementAuthorizationConfirmed: {
      type: Boolean,
      default: false
    },
    managementAuthorizationConfirmedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: {
        values: Object.values(FamilyMemberStatus),
        message: '{VALUE} is not a valid family member status'
      },
      default: FamilyMemberStatus.ACTIVE,
      index: true
    },
    archivedAt: {
      type: Date
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

// Compound indexes for optimal isolation, filtering, and query performance
familyMemberSchema.index({ ownerUserId: 1, status: 1, isDeleted: 1 });
familyMemberSchema.index({ ownerUserId: 1, relationship: 1, isDeleted: 1 });
familyMemberSchema.index({ ownerUserId: 1, createdAt: -1 });

export const FamilyMember: Model<FamilyMemberDocument> = model<FamilyMemberDocument>(
  'FamilyMember',
  familyMemberSchema,
  'familyMembers'
);
