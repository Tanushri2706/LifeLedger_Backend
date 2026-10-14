import { Schema, model, Document, Model } from 'mongoose';
import {
  IAppointment,
  IAppointmentTimeSlot,
  AppointmentStatus,
  ConsultationType,
  CancelledBy
} from '../types';

export type AppointmentDocument = Document & IAppointment;

const timeSlotSchema = new Schema<IAppointmentTimeSlot>(
  {
    start: {
      type: String,
      required: [true, 'Start time is required'],
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide start time in HH:mm format']
    },
    end: {
      type: String,
      required: [true, 'End time is required'],
      trim: true,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Please provide end time in HH:mm format']
    }
  },
  { _id: false }
);

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required for appointment'],
      index: true
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required for appointment'],
      index: true
    },
    hospital: {
      type: String,
      required: [true, 'Hospital or clinic name is required'],
      trim: true
    },
    appointmentDate: {
      type: Date,
      required: [true, 'Appointment date is required'],
      index: true
    },
    timeSlot: {
      type: timeSlotSchema,
      required: [true, 'Time slot is required']
    },
    status: {
      type: String,
      required: [true, 'Appointment status is required'],
      enum: {
        values: Object.values(AppointmentStatus),
        message: '{VALUE} is not a valid appointment status'
      },
      default: AppointmentStatus.CONFIRMED,
      index: true
    },
    consultationType: {
      type: String,
      enum: {
        values: Object.values(ConsultationType),
        message: '{VALUE} is not a valid consultation type'
      },
      default: ConsultationType.IN_PERSON
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Appointment notes cannot exceed 1000 characters']
    },
    prescriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Prescription'
    },
    cancelledBy: {
      type: String,
      enum: {
        values: Object.values(CancelledBy),
        message: '{VALUE} is not a valid cancellation initiator'
      }
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
    },
    cancelledAt: {
      type: Date
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

// Concurrency & Double-Booking Protection:
// Partial unique index ensures that for a given doctor, date, and start time,
// at most ONE active (pending or confirmed) non-deleted appointment can exist.
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, 'timeSlot.start': 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      isDeleted: false
    }
  }
);

// Performance indexes for patient, doctor, and date queries
appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: -1 });
appointmentSchema.index({ patientId: 1, status: 1 });
appointmentSchema.index({ doctorId: 1, status: 1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });

export const Appointment: Model<AppointmentDocument> = model<AppointmentDocument>(
  'Appointment',
  appointmentSchema,
  'appointments'
);
