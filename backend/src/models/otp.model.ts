import { Schema, model, Document, Model } from 'mongoose';
import { OtpPurpose } from '../types';

export interface IOtp {
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
  attempts: number;
  isVerified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type OtpDocument = Document & IOtp;

const otpSchema = new Schema<OtpDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required for OTP verification'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    otpHash: {
      type: String,
      required: [true, 'OTP hash is required']
    },
    purpose: {
      type: String,
      required: [true, 'OTP purpose is required'],
      enum: {
        values: Object.values(OtpPurpose),
        message: '{VALUE} is not a valid OTP purpose'
      }
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration timestamp is required']
    },
    attempts: {
      type: Number,
      default: 0,
      min: [0, 'Attempts cannot be negative'],
      max: [5, 'Maximum attempts reached']
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// TTL Index: automatically removes OTP document when expiresAt has elapsed
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for querying active OTPs by email and purpose
otpSchema.index({ email: 1, purpose: 1 });

export const Otp: Model<OtpDocument> = model<OtpDocument>('Otp', otpSchema, 'otps');
