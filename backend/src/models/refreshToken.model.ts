import { Schema, model, Document, Model, Types } from 'mongoose';
import { IDeviceInfo } from '../types';

export interface IRefreshToken {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  deviceInfo?: IDeviceInfo;
  createdAt: Date;
  updatedAt: Date;
}

export type RefreshTokenDocument = Document & IRefreshToken;

const deviceInfoSchema = new Schema<IDeviceInfo>(
  {
    userAgent: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    deviceType: { type: String, trim: true }
  },
  { _id: false }
);

const refreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for refresh token'],
      index: true
    },
    tokenHash: {
      type: String,
      required: [true, 'Token hash is required'],
      unique: true,
      index: true
    },
    expiresAt: {
      type: Date,
      required: [true, 'Token expiration date is required']
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    revokedAt: {
      type: Date
    },
    revokedReason: {
      type: String,
      trim: true
    },
    deviceInfo: {
      type: deviceInfoSchema
    }
  },
  {
    timestamps: true
  }
);

// TTL Index: automatically remove documents when `expiresAt` has passed
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for active session lookup per user
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

export const RefreshToken: Model<RefreshTokenDocument> = model<RefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema,
  'refreshTokens'
);
