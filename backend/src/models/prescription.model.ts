import { Schema, model, Document, Model } from 'mongoose';
import { IPrescription, IPrescriptionMedicine } from '../types';

export type PrescriptionDocument = Document & IPrescription;

const prescriptionMedicineSchema = new Schema<IPrescriptionMedicine>(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required (e.g., 500mg)'],
      trim: true
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required (e.g., twice daily, 1-0-1)'],
      trim: true
    },
    duration: {
      type: String,
      required: [true, 'Duration is required (e.g., 5 days)'],
      trim: true
    },
    instructions: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const prescriptionSchema = new Schema<PrescriptionDocument>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment reference is required for prescription'],
      unique: true,
      index: true
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor reference is required for prescription'],
      index: true
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient reference is required for prescription'],
      index: true
    },
    medicines: {
      type: [prescriptionMedicineSchema],
      required: [true, 'Prescription medicines list is required'],
      validate: {
        validator: function (v: IPrescriptionMedicine[]) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Prescription must contain at least one medicine'
      }
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: [2000, 'Instructions cannot exceed 2000 characters']
    },
    nextVisit: {
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

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

export const Prescription: Model<PrescriptionDocument> = model<PrescriptionDocument>(
  'Prescription',
  prescriptionSchema,
  'prescriptions'
);
