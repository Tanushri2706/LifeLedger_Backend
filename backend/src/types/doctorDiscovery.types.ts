import { IDoctorAvailability } from './models.types';

export interface GetDoctorsQueryDto {
  search?: string;
  query?: string;
  q?: string;
  specialization?: string;
  specialty?: string;
  hospital?: string;
  city?: string;
  gender?: string;
  minRating?: number | string;
  maxFee?: number | string;
  verified?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

export interface PublicDoctorProfileDto {
  id: string;
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  gender?: string;
  city?: string;
  state?: string;
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
}

export interface SearchDoctorsQueryDto {
  q?: string;
  query?: string;
  search?: string;
  specialization?: string;
  hospital?: string;
  city?: string;
  page?: number | string;
  limit?: number | string;
}

export interface GetDoctorAvailabilityQueryDto {
  doctorId?: string;
  id?: string;
  day?: string;
}
