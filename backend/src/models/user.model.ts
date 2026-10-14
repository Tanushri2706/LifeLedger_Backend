import { Schema, model, Document, Model } from 'mongoose';
import { UserRole, Gender, BloodGroup, IEmergencyContact } from '../types';

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password?: string;
  googleId?: string;
  appleId?: string;
  avatar?: string;
  avatarPublicId?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  height?: number;
  weight?: number;
  emergencyContact?: IEmergencyContact;
  emergencyContacts?: IEmergencyContact[];
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  role: UserRole;
  healthScore: number;
  isVerified: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = Document & IUser;

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  { _id: false }
);

const emergencyContactItemSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, trim: true, required: true },
    relationship: { type: String, trim: true, required: true },
    phone: { type: String, trim: true, required: true },
    isPrimary: { type: Boolean, default: false },
    notes: { type: String, trim: true }
  },
  { _id: true, timestamps: true }
);

const userSchema = new Schema<UserDocument>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [1, 'First name cannot be empty'],
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [1, 'Last name cannot be empty'],
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    phone: {
      type: String,
      sparse: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      select: false,
      minlength: [6, 'Password must be at least 6 characters']
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true
    },
    appleId: {
      type: String,
      sparse: true,
      unique: true,
      trim: true
    },
    avatar: {
      type: String,
      trim: true
    },
    avatarPublicId: {
      type: String,
      trim: true
    },
    dateOfBirth: {
      type: Date
    },
    gender: {
      type: String,
      enum: {
        values: Object.values(Gender),
        message: '{VALUE} is not a supported gender'
      }
    },
    bloodGroup: {
      type: String,
      enum: {
        values: Object.values(BloodGroup),
        message: '{VALUE} is not a valid blood group'
      }
    },
    height: {
      type: Number,
      min: [0, 'Height cannot be negative']
    },
    weight: {
      type: Number,
      min: [0, 'Weight cannot be negative']
    },
    emergencyContact: {
      type: emergencyContactSchema
    },
    emergencyContacts: {
      type: [emergencyContactItemSchema],
      default: []
    },
    address: {
      type: String,
      trim: true
    },
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true
    },
    pincode: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: '{VALUE} is not a valid user role'
      },
      default: UserRole.PATIENT,
      index: true
    },
    healthScore: {
      type: Number,
      default: 0,
      min: [0, 'Health score cannot be negative'],
      max: [100, 'Health score cannot exceed 100']
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.avatarPublicId;
        return ret;
      }
    }
  }
);

export const User: Model<UserDocument> = model<UserDocument>('User', userSchema, 'users');
