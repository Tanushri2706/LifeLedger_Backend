import { Schema, model, Document, Model } from 'mongoose';
import { IHospital, HealthcareFacilityType } from '../types';

export type HospitalDocument = Document & IHospital;

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

const hospitalSchema = new Schema<HospitalDocument>(
  {
    name: {
      type: String,
      required: [true, 'Hospital / Facility name is required'],
      trim: true,
      index: true
    },
    type: {
      type: String,
      enum: {
        values: Object.values(HealthcareFacilityType),
        message: '{VALUE} is not a valid healthcare facility type'
      },
      default: HealthcareFacilityType.HOSPITAL,
      index: true
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
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
    country: {
      type: String,
      trim: true,
      default: 'India'
    },
    pincode: {
      type: String,
      trim: true
    },
    location: {
      type: geoLocationSchema,
      required: [true, 'Geospatial location is required']
    },
    rating: {
      type: Number,
      default: 4.5,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5']
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative']
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    website: {
      type: String,
      trim: true
    },
    specialities: {
      type: [String],
      default: []
    },
    emergencyAvailable: {
      type: Boolean,
      default: false,
      index: true
    },
    ambulanceAvailable: {
      type: Boolean,
      default: false
    },
    bloodBankAvailable: {
      type: Boolean,
      default: false
    },
    operatingHours: {
      type: String,
      trim: true,
      default: '24/7'
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

// Geospatial 2dsphere index for nearby discovery
hospitalSchema.index({ location: '2dsphere' });

// Compound indexes for fast filtering
hospitalSchema.index({ type: 1, isDeleted: 1 });
hospitalSchema.index({ emergencyAvailable: 1, isDeleted: 1 });
hospitalSchema.index({ city: 1, isDeleted: 1 });
hospitalSchema.index({ name: 'text', address: 'text', specialities: 'text' });

export const Hospital: Model<HospitalDocument> = model<HospitalDocument>('Hospital', hospitalSchema, 'hospitals');
