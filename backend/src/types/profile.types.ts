import { Gender, BloodGroup, IDoctorAvailability, IEmergencyContact, UserRole } from './models.types';

export interface UpdateUserProfileDto {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string | Date;
  bloodGroup?: BloodGroup;
  height?: number;
  weight?: number;
  emergencyContact?: IEmergencyContact;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface RequestEmailChangeDto {
  newEmail: string;
}

export interface VerifyEmailChangeDto {
  newEmail: string;
  otp: string;
}

export interface UserProfileResponse {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profilePhoto: string | null;
  avatar: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  bloodGroup: BloodGroup | null;
  role: UserRole;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  height?: number;
  weight?: number;
  emergencyContact?: IEmergencyContact;
  emergencyContacts?: IEmergencyContact[];
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  healthScore?: number;
}

export interface UpdateDoctorProfileDto extends UpdateUserProfileDto {
  specialization?: string;
  experience?: number;
  qualification?: string;
  hospital?: string;
  consultationFee?: number;
  languages?: string[];
  availability?: IDoctorAvailability[];
}

export interface IUserDashboardData {
  profileSummary: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    role: UserRole;
    isVerified: boolean;
    healthScore: number;
    bloodGroup?: BloodGroup;
    emergencyContact?: IEmergencyContact;
  };
  accountStatus: {
    isVerified: boolean;
    isProfileComplete: boolean;
    memberSince: Date;
    lastUpdated: Date;
  };
  vitals: {
    height?: number;
    weight?: number;
    bmi: number | null;
  };
  metrics: {
    healthScore: number;
    profileCompletionPercentage: number;
  };
  healthVault?: {
    totalReports: number;
    recentReports: Array<{
      id: string;
      title: string;
      category: string;
      reportDate: Date;
      fileUrl: string;
    }>;
  };
  timelinePreview?: {
    totalEvents: number;
    recentEvents: Array<{
      id: string;
      eventType: string;
      title: string;
      description: string;
      date: Date;
      sourceType: string;
    }>;
  };
}

export interface IDoctorDashboardData {
  profileSummary: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    role: UserRole;
    isVerified: boolean;
  };
  professionalSummary: {
    doctorId: string;
    licenseNumber: string;
    specialization: string;
    experience: number;
    qualification: string;
    hospital: string;
    consultationFee: number;
    languages: string[];
    availabilitySlotCount: number;
    verified: boolean;
  };
  accountStatus: {
    isVerified: boolean;
    licenseVerified: boolean;
    memberSince: Date;
    lastUpdated: Date;
  };
  metrics: {
    rating: number;
    reviewCount: number;
    experienceYears: number;
  };
}
