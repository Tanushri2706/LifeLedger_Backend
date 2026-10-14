export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  ADMIN = 'admin'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
  PREFER_NOT_TO_SAY = 'prefer_not_to_say'
}

export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-'
}

export enum OtpPurpose {
  SIGNUP_VERIFICATION = 'signup_verification',
  PASSWORD_RESET = 'password_reset',
  LOGIN_VERIFICATION = 'login_verification',
  EMAIL_CHANGE = 'email_change'
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday'
}

export interface IEmergencyContact {
  id?: string;
  _id?: string;
  name?: string;
  relationship?: string;
  phone?: string;
  isPrimary?: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITimeSlot {
  start: string; // "09:00"
  end: string;   // "17:00"
}

export interface IDoctorAvailability {
  day: DayOfWeek;
  slots: ITimeSlot[];
}

export interface IDeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  deviceType?: string;
}
