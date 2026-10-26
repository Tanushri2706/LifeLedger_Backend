import { Types } from 'mongoose';

export interface IPrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface IPrescription {
  appointmentId: Types.ObjectId;
  doctorId: Types.ObjectId;
  patientId: Types.ObjectId;
  medicines: IPrescriptionMedicine[];
  instructions?: string;
  nextVisit?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePrescriptionDto {
  medicines: IPrescriptionMedicine[];
  instructions?: string;
  nextVisit?: string | Date; // ISO string or Date
}

export interface PrescriptionResponseDto {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName?: string;
  doctor?: {
    id: string;
    name: string;
    specialization: string;
    hospital: string;
    qualification?: string;
  };
  patientId: string;
  patientName?: string;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    name?: string;
    fullName?: string;
    displayName?: string;
    email?: string;
    gender?: string;
    bloodGroup?: string;
  };
  medicines: IPrescriptionMedicine[];
  instructions?: string;
  nextVisit?: Date;
  createdAt: Date;
  updatedAt: Date;
}
