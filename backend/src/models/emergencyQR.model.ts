import { Schema, model, Document, Model } from 'mongoose';
import { IEmergencyQR, BloodGroup, IEmergencyContact } from '../types';

export type EmergencyQRDocument = Document & IEmergencyQR;

const emergencyContactSubSchema = new Schema<IEmergencyContact>(
  {
    name: {
      type: String,
      required: [true, 'Contact name is required'],
      trim: true
    },
    relationship: {
      type: String,
      required: [true, 'Relationship is required'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Contact phone is required'],
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String,
      trim: true
    }
  },
  { _id: true, timestamps: true }
);

const emergencyQRSchema = new Schema<EmergencyQRDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for Emergency QR mapping'],
      unique: true,
      index: true
    },
    qrToken: {
      type: String,
      required: [true, 'Cryptographic QR token is required'],
      unique: true,
      index: true,
      trim: true
    },
    qrCode: {
      type: String,
      required: [true, 'QR code representation/URI is required'],
      trim: true
    },
    bloodGroup: {
      type: String,
      enum: {
        values: Object.values(BloodGroup),
        message: '{VALUE} is not a valid blood group'
      }
    },
    allergies: {
      type: [String],
      default: []
    },
    medicalConditions: {
      type: [String],
      default: []
    },
    criticalNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Critical emergency notes cannot exceed 500 characters']
    },
    emergencyContacts: {
      type: [emergencyContactSubSchema],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastAccessedAt: {
      type: Date
    },
    accessCount: {
      type: Number,
      default: 0,
      min: [0, 'Access count cannot be negative']
    }
  },
  {
    timestamps: true
  }
);

export const EmergencyQR: Model<EmergencyQRDocument> = model<EmergencyQRDocument>(
  'EmergencyQR',
  emergencyQRSchema,
  'emergencyQRs'
);
