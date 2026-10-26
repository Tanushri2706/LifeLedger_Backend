import { Schema, model, Document, Model } from 'mongoose';
import { ISOSRecord, SOSStatus } from '../types';

export type SOSEventDocument = Document & ISOSRecord;

const geoLocationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  { _id: false }
);

const sosEventSchema = new Schema<SOSEventDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for SOS event log'],
      index: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(SOSStatus),
        message: '{VALUE} is not a valid SOS status'
      },
      default: SOSStatus.TRIGGERED,
      index: true
    },
    location: {
      type: geoLocationSchema
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'SOS notes cannot exceed 500 characters']
    },
    contactsNotifiedCount: {
      type: Number,
      default: 0,
      min: 0
    },
    dispatchedRealEmergency: {
      type: Boolean,
      default: false
    },
    disclaimer: {
      type: String,
      default:
        'This SOS event is recorded for personal safety audit. No live 112/108 emergency dispatch was triggered by this software.'
    }
  },
  {
    timestamps: true
  }
);

sosEventSchema.index({ userId: 1, createdAt: -1 });

export const SOSEvent: Model<SOSEventDocument> = model<SOSEventDocument>(
  'SOSEvent',
  sosEventSchema,
  'sosEvents'
);
