import { Schema, model, Document, Model } from 'mongoose';
import { IAmbulance, AmbulanceType, AmbulanceStatus } from '../types';

export type AmbulanceDocument = Document & IAmbulance;

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
      required: [true, 'Geographical coordinates [lng, lat] are required'],
      validate: {
        validator: function (val: number[] | undefined) {
          if (!val || !Array.isArray(val) || val.length !== 2) return false;
          const [lng, lat] = val;
          return (
            typeof lng === 'number' &&
            typeof lat === 'number' &&
            lng >= -180 &&
            lng <= 180 &&
            lat >= -90 &&
            lat <= 90
          );
        },
        message: 'Coordinates must be valid [longitude (-180..180), latitude (-90..90)]'
      }
    }
  },
  { _id: false }
);

const ambulanceSchema = new Schema<AmbulanceDocument>(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'Hospital',
      sparse: true,
      index: true
    },
    hospitalName: {
      type: String,
      trim: true
    },
    vehicleNumber: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: {
        values: Object.values(AmbulanceType),
        message: '{VALUE} is not a supported ambulance type'
      },
      default: AmbulanceType.BASIC,
      index: true
    },
    driverName: {
      type: String,
      trim: true
    },
    driverPhone: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: Object.values(AmbulanceStatus),
        message: '{VALUE} is not a valid ambulance status'
      },
      default: AmbulanceStatus.AVAILABLE,
      index: true
    },
    currentLocation: {
      type: geoLocationSchema,
      required: [true, 'Ambulance location coordinates are required']
    },
    baseStationAddress: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true,
      index: true
    },
    state: {
      type: String,
      trim: true
    },
    isVerified: {
      type: Boolean,
      default: true
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

// 2dsphere index on currentLocation for fast geospatial discovery
ambulanceSchema.index({ currentLocation: '2dsphere' });

// Compound indexes for querying and filtering
ambulanceSchema.index({ status: 1, isDeleted: 1 });
ambulanceSchema.index({ type: 1, status: 1, isDeleted: 1 });
ambulanceSchema.index({ hospitalId: 1, isDeleted: 1 });

export const Ambulance: Model<AmbulanceDocument> = model<AmbulanceDocument>(
  'Ambulance',
  ambulanceSchema,
  'ambulances'
);
