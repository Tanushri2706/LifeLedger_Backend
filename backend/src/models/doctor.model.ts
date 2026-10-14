import { Schema, model, Document, Model, Types } from 'mongoose';
import { DayOfWeek, IDoctorAvailability, ITimeSlot } from '../types';

export interface IDoctor {
  userId: Types.ObjectId;
  licenseNumber: string;
  specialization: string;
  experience: number;
  qualification: string;
  hospital: string;
  consultationFee: number;
  languages: string[];
  availability: IDoctorAvailability[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type DoctorDocument = Document & IDoctor;

const timeSlotSchema = new Schema<ITimeSlot>(
  {
    start: {
      type: String,
      required: true,
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid time in HH:mm format']
    },
    end: {
      type: String,
      required: true,
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide a valid time in HH:mm format']
    }
  },
  { _id: false }
);

const availabilitySchema = new Schema<IDoctorAvailability>(
  {
    day: {
      type: String,
      required: true,
      enum: {
        values: Object.values(DayOfWeek),
        message: '{VALUE} is not a valid day of the week'
      }
    },
    slots: {
      type: [timeSlotSchema],
      default: []
    }
  },
  { _id: false }
);

const doctorSchema = new Schema<DoctorDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required for doctor profile'],
      unique: true,
      index: true
    },
    licenseNumber: {
      type: String,
      required: [true, 'Medical license number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
      index: true
    },
    experience: {
      type: Number,
      required: [true, 'Years of experience is required'],
      min: [0, 'Experience cannot be negative']
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
      trim: true
    },
    hospital: {
      type: String,
      required: [true, 'Hospital/Clinic name is required'],
      trim: true,
      index: true
    },
    consultationFee: {
      type: Number,
      required: [true, 'Consultation fee is required'],
      min: [0, 'Consultation fee cannot be negative']
    },
    languages: {
      type: [String],
      default: ['English']
    },
    availability: {
      type: [availabilitySchema],
      default: []
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be below 0'],
      max: [5, 'Rating cannot exceed 5']
    },
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'Review count cannot be negative']
    },
    verified: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const Doctor: Model<DoctorDocument> = model<DoctorDocument>('Doctor', doctorSchema, 'doctors');
