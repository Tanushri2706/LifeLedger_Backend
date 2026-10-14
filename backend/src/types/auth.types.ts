import { UserRole, Gender, BloodGroup, IDoctorAvailability, IEmergencyContact } from './models.types';

export interface ITokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
}

export interface IAuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  isVerified: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: IAuthenticatedUser;
    }
  }
}

export interface SignupUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string | Date;
  bloodGroup?: BloodGroup;
  emergencyContact?: IEmergencyContact;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface SignupDoctorDto extends SignupUserDto {
  licenseNumber: string;
  specialization: string;
  experience: number;
  qualification: string;
  hospital: string;
  consultationFee: number;
  languages?: string[];
  availability?: IDoctorAvailability[];
}

export type AuthPortal = 'patient' | 'doctor';

export interface LoginDto {
  email: string;
  password: string;
  portal?: AuthPortal | string;
}

export interface VerifyEmailDto {
  email: string;
  otp: string;
}

export interface ResendOtpDto {
  email: string;
  purpose?: string;
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  email: string;
  otp: string;
  newPassword: string;
}

export interface AuthResponseData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isVerified: boolean;
    phone?: string;
    avatar?: string;
    healthScore?: number;
  };
  accessToken?: string;
}
