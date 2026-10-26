import { Types } from 'mongoose';
import { DayOfWeek } from './models.types';

export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  NO_SHOW = 'no_show'
}

export enum ConsultationType {
  IN_PERSON = 'in_person',
  VIDEO = 'video',
  AUDIO = 'audio'
}

export enum CancelledBy {
  PATIENT = 'patient',
  DOCTOR = 'doctor'
}

export interface IAppointmentTimeSlot {
  start: string; // e.g. "09:00"
  end: string;   // e.g. "09:30"
}

export interface IAppointment {
  patientId: Types.ObjectId;
  doctorId: Types.ObjectId;
  hospital: string;
  appointmentDate: Date;
  timeSlot: IAppointmentTimeSlot;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  notes?: string;
  prescriptionId?: Types.ObjectId;
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
  cancelledAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookAppointmentDto {
  doctorId: string;
  appointmentDate: string; // "YYYY-MM-DD"
  timeSlot: IAppointmentTimeSlot;
  consultationType?: ConsultationType;
  hospital?: string;
  notes?: string;
}

export interface RescheduleAppointmentDto {
  appointmentDate: string; // "YYYY-MM-DD"
  timeSlot: IAppointmentTimeSlot;
  notes?: string;
}

export interface CancelAppointmentDto {
  reason?: string;
}

export interface RejectAppointmentDto {
  reason?: string;
}

export interface GetAppointmentsQueryDto {
  page?: string | number;
  limit?: string | number;
  status?: AppointmentStatus;
  upcoming?: string | boolean;
  startDate?: string;
  endDate?: string;
}

export interface DoctorAppointmentsQueryDto extends GetAppointmentsQueryDto {
  patientId?: string;
  date?: string;
}

export interface GetAvailableSlotsQueryDto {
  date: string; // "YYYY-MM-DD"
  durationMinutes?: string | number;
}

export interface AvailableSlotDto {
  start: string;
  end: string;
  isAvailable: boolean;
  reason?: string;
}

export interface DoctorAvailableSlotsResponseDto {
  doctorId: string;
  doctorName: string;
  specialization: string;
  hospital: string;
  date: string; // "YYYY-MM-DD"
  dayOfWeek: DayOfWeek;
  slotDurationMinutes: number;
  totalSlots: number;
  availableSlotsCount: number;
  slots: AvailableSlotDto[];
}

export interface AppointmentResponseDto {
  id: string;
  referenceNumber: string;
  patientId: string;
  patientName?: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    name: string;
    fullName: string;
    displayName: string;
    email?: string;
    phone?: string;
    avatar?: string;
    gender?: string;
    bloodGroup?: string;
    age?: number;
  };
  doctorId: string;
  doctorName?: string;
  doctor?: {
    id: string;
    name: string;
    specialization: string;
    hospital: string;
    consultationFee: number;
    avatar?: string;
    qualification?: string;
  };
  hospital: string;
  appointmentDate: Date;
  date?: string;
  time?: string;
  timeSlot: IAppointmentTimeSlot;
  status: AppointmentStatus;
  consultationType: ConsultationType;
  notes?: string;
  reason?: string;
  prescriptionId?: string;
  hasPrescription?: boolean;
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
