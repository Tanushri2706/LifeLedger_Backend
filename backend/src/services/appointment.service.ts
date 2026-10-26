import { Types } from 'mongoose';
import {
  User,
  Doctor,
  Appointment,
  Prescription,
  AppointmentDocument,
  DoctorDocument,
  UserDocument
} from '../models';
import {
  UserRole,
  AppointmentStatus,
  ConsultationType,
  CancelledBy,
  DayOfWeek,
  IDoctorAvailability,
  BookAppointmentDto,
  RescheduleAppointmentDto,
  CancelAppointmentDto,
  RejectAppointmentDto,
  GetAppointmentsQueryDto,
  DoctorAppointmentsQueryDto,
  GetAvailableSlotsQueryDto,
  DoctorAvailableSlotsResponseDto,
  AvailableSlotDto,
  AppointmentResponseDto,
  CreatePrescriptionDto,
  PrescriptionResponseDto,
  TimelineEventType
} from '../types';
import {
  AppError,
  normalizeDate,
  timeToMinutes,
  minutesToTime,
  getDayOfWeek,
  getTodayNormalizedDate,
  isDateInPast,
  isDateToday,
  isSlotInPast
} from '../utils';
import { timelineService } from './timeline.service';
import { notificationHookService } from './notificationHook.service';

export class AppointmentService {
  /**
   * Helper to normalize a date string (YYYY-MM-DD) to UTC midnight Date.
   */
  public normalizeDate(dateStr: string): Date {
    return normalizeDate(dateStr);
  }

  /**
   * Helper to get DayOfWeek from a Date in UTC.
   */
  public getDayOfWeek(date: Date): DayOfWeek {
    return getDayOfWeek(date);
  }

  /**
   * Validates and formats a single doctor document with its user information.
   */
  private async findDoctorDocument(id: string): Promise<{ doctor: DoctorDocument; user: UserDocument }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError('Doctor not found', 404);
    }

    const objectId = new Types.ObjectId(id);
    const doctor = await Doctor.findOne({
      $or: [{ _id: objectId }, { userId: objectId }]
    }).populate<{ userId: UserDocument }>({
      path: 'userId',
      match: { isDeleted: false }
    });

    if (!doctor || !doctor.userId) {
      throw new AppError('Doctor not found', 404);
    }

    return {
      doctor: doctor as unknown as DoctorDocument,
      user: doctor.userId as unknown as UserDocument
    };
  }

  /**
   * Format appointment for API response
   */
  private formatAppointmentResponse(appt: any): AppointmentResponseDto {
    const json = typeof appt.toJSON === 'function' ? appt.toJSON() : appt;
    const patient = json.patientId && typeof json.patientId === 'object' ? json.patientId : null;
    const doctor = json.doctorId && typeof json.doctorId === 'object' ? json.doctorId : null;
    const doctorUser = doctor && doctor.userId && typeof doctor.userId === 'object' ? doctor.userId : null;

    let doctorFormatted;
    const docName = doctor
      ? (doctorUser
          ? `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim()
          : (doctor.name || 'Doctor'))
      : undefined;

    if (doctor) {
      doctorFormatted = {
        id: doctor._id ? doctor._id.toString() : String(doctor),
        name: docName || 'Doctor',
        specialization: doctor.specialization || 'General Medicine',
        hospital: doctor.hospital || json.hospital || 'Clinic',
        consultationFee: doctor.consultationFee || 0,
        avatar: doctorUser?.avatar,
        qualification: doctor.qualification
      };
    }

    let patientFormatted;
    let patientName: string | undefined;
    if (patient) {
      const pDisplayName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
      patientName = pDisplayName;

      let age: number | undefined;
      if (patient.dateOfBirth) {
        const dob = new Date(patient.dateOfBirth);
        if (!isNaN(dob.getTime())) {
          const diffMs = Date.now() - dob.getTime();
          age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25));
        }
      }

      patientFormatted = {
        id: patient._id ? patient._id.toString() : String(patient),
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        name: pDisplayName,
        fullName: pDisplayName,
        displayName: pDisplayName,
        email: patient.email,
        phone: patient.phone,
        avatar: patient.avatar,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        age
      };
    }

    const apptDateObj = json.appointmentDate ? new Date(json.appointmentDate) : new Date();
    const dateStr = apptDateObj.toISOString().split('T')[0];
    const timeStr = json.timeSlot && json.timeSlot.start && json.timeSlot.end ? `${json.timeSlot.start} - ${json.timeSlot.end}` : undefined;

    return {
      id: json._id.toString(),
      referenceNumber: json._id.toString(),
      patientId: patient?._id ? patient._id.toString() : String(json.patientId),
      patientName,
      patient: patientFormatted,
      doctorId: doctor?._id ? doctor._id.toString() : String(json.doctorId),
      doctorName: docName,
      doctor: doctorFormatted,
      hospital: json.hospital,
      appointmentDate: apptDateObj,
      date: dateStr,
      time: timeStr,
      timeSlot: json.timeSlot,
      status: json.status as AppointmentStatus,
      consultationType: json.consultationType as ConsultationType,
      notes: json.notes,
      reason: json.notes,
      prescriptionId: json.prescriptionId ? json.prescriptionId.toString() : undefined,
      hasPrescription: Boolean(json.prescriptionId),
      cancelledBy: json.cancelledBy as CancelledBy | undefined,
      cancellationReason: json.cancellationReason,
      cancelledAt: json.cancelledAt ? new Date(json.cancelledAt) : undefined,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt)
    };
  }

  /**
   * Format prescription for API response
   */
  private formatPrescriptionResponse(prescription: any): PrescriptionResponseDto {
    const json = typeof prescription.toJSON === 'function' ? prescription.toJSON() : prescription;
    const patient = json.patientId && typeof json.patientId === 'object' ? json.patientId : null;
    const doctor = json.doctorId && typeof json.doctorId === 'object' ? json.doctorId : null;
    const doctorUser = doctor && doctor.userId && typeof doctor.userId === 'object' ? doctor.userId : null;

    let doctorFormatted;
    const docName = doctor
      ? (doctorUser
          ? `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim()
          : (doctor.name || 'Doctor'))
      : undefined;

    if (doctor) {
      doctorFormatted = {
        id: doctor._id ? doctor._id.toString() : String(doctor),
        name: docName || 'Doctor',
        specialization: doctor.specialization || 'General Medicine',
        hospital: doctor.hospital || 'Clinic',
        qualification: doctor.qualification
      };
    }

    let patientFormatted;
    let patientName: string | undefined;
    if (patient) {
      const pDisplayName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient';
      patientName = pDisplayName;

      patientFormatted = {
        id: patient._id ? patient._id.toString() : String(patient),
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        name: pDisplayName,
        fullName: pDisplayName,
        displayName: pDisplayName,
        email: patient.email,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup
      };
    }

    return {
      id: json._id.toString(),
      appointmentId: json.appointmentId?._id ? json.appointmentId._id.toString() : String(json.appointmentId),
      doctorId: doctor?._id ? doctor._id.toString() : String(json.doctorId),
      doctorName: docName,
      doctor: doctorFormatted,
      patientId: patient?._id ? patient._id.toString() : String(json.patientId),
      patientName,
      patient: patientFormatted,
      medicines: json.medicines || [],
      instructions: json.instructions,
      nextVisit: json.nextVisit ? new Date(json.nextVisit) : undefined,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt)
    };
  }

  // ==========================================
  // 1. DOCTOR AVAILABILITY MANAGEMENT
  // ==========================================

  public async updateDoctorAvailability(
    doctorUserId: string,
    availability: IDoctorAvailability[]
  ): Promise<{ availability: IDoctorAvailability[] }> {
    if (!Array.isArray(availability)) {
      throw new AppError('Availability must be an array of schedule objects', 400);
    }

    const doctor = await Doctor.findOne({ userId: doctorUserId });
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    const validDays = Object.values(DayOfWeek);
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    for (const item of availability) {
      if (!validDays.includes(item.day)) {
        throw new AppError(`Invalid day of week: ${item.day}`, 400);
      }
      if (!Array.isArray(item.slots)) {
        throw new AppError(`Slots for ${item.day} must be an array of time slots`, 400);
      }

      // Check each time slot
      const sortedSlots = [...item.slots].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

      for (let i = 0; i < sortedSlots.length; i++) {
        const slot = sortedSlots[i];
        if (!slot) continue;
        if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
          throw new AppError(`Invalid time format in slot for ${item.day}. Must be HH:mm`, 400);
        }
        const startMin = timeToMinutes(slot.start);
        const endMin = timeToMinutes(slot.end);

        if (startMin >= endMin) {
          throw new AppError(`Start time (${slot.start}) must be before end time (${slot.end}) on ${item.day}`, 400);
        }

        // Check overlapping slots
        if (i > 0) {
          const prevSlot = sortedSlots[i - 1];
          if (!prevSlot) continue;
          const prevEndMin = timeToMinutes(prevSlot.end);
          if (startMin < prevEndMin) {
            throw new AppError(`Overlapping time slots detected on ${item.day}: ${prevSlot.start}-${prevSlot.end} and ${slot.start}-${slot.end}`, 400);
          }
        }
      }
    }

    doctor.availability = availability;
    await doctor.save();

    return { availability: doctor.availability };
  }

  public async getDoctorAvailabilitySchedule(doctorIdOrUserId: string): Promise<{
    doctorId: string;
    doctorName: string;
    specialization: string;
    hospital: string;
    availability: IDoctorAvailability[];
  }> {
    const { doctor, user } = await this.findDoctorDocument(doctorIdOrUserId);
    return {
      doctorId: doctor._id.toString(),
      doctorName: `Dr. ${user.firstName} ${user.lastName}`.trim(),
      specialization: doctor.specialization,
      hospital: doctor.hospital,
      availability: doctor.availability || []
    };
  }

  // ==========================================
  // 2. GENERATE AVAILABLE SLOTS
  // ==========================================

  public async getAvailableSlots(
    doctorId: string,
    query: GetAvailableSlotsQueryDto
  ): Promise<DoctorAvailableSlotsResponseDto> {
    if (!query.date) {
      throw new AppError('Date query parameter is required (YYYY-MM-DD)', 400);
    }

    const { doctor, user } = await this.findDoctorDocument(doctorId);
    const targetDate = normalizeDate(query.date);

    // Ensure target date is not in the past relative to Asia/Kolkata
    if (isDateInPast(targetDate)) {
      throw new AppError('Cannot check available slots for past dates', 400);
    }

    const dayOfWeek = getDayOfWeek(targetDate);
    const slotDuration = Math.max(10, Math.min(120, parseInt(String(query.durationMinutes), 10) || 30));

    // Find availability window for this day of week
    const daySchedule = (doctor.availability || []).find(
      (a) => a.day.toLowerCase() === dayOfWeek.toLowerCase()
    );

    const generatedSlots: AvailableSlotDto[] = [];

    if (daySchedule && Array.isArray(daySchedule.slots)) {
      for (const window of daySchedule.slots) {
        const windowStartMin = timeToMinutes(window.start);
        const windowEndMin = timeToMinutes(window.end);

        let currentStart = windowStartMin;
        while (currentStart + slotDuration <= windowEndMin) {
          const slotStartStr = minutesToTime(currentStart);
          const slotEndStr = minutesToTime(currentStart + slotDuration);

          generatedSlots.push({
            start: slotStartStr,
            end: slotEndStr,
            isAvailable: true
          });

          currentStart += slotDuration;
        }
      }
    }

    // Query all active booked appointments for this doctor on this normalized date
    const bookedAppointments = await Appointment.find({
      doctorId: doctor._id,
      appointmentDate: targetDate,
      status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      isDeleted: false
    }).select('timeSlot');

    const bookedStarts = new Set(bookedAppointments.map((a) => a.timeSlot.start));

    // If date is today in Asia/Kolkata, check whether the time slot has already passed
    const isToday = isDateToday(targetDate);

    for (const slot of generatedSlots) {
      if (bookedStarts.has(slot.start)) {
        slot.isAvailable = false;
        slot.reason = 'Already booked';
      } else if (isToday) {
        if (isSlotInPast(slot.start)) {
          slot.isAvailable = false;
          slot.reason = 'Time slot has passed';
        }
      }
    }

    const availableSlotsCount = generatedSlots.filter((s) => s.isAvailable).length;

    return {
      doctorId: doctor._id.toString(),
      doctorName: `Dr. ${user.firstName} ${user.lastName}`.trim(),
      specialization: doctor.specialization,
      hospital: doctor.hospital,
      date: query.date,
      dayOfWeek,
      slotDurationMinutes: slotDuration,
      totalSlots: generatedSlots.length,
      availableSlotsCount,
      slots: generatedSlots
    };
  }

  // ==========================================
  // 3. APPOINTMENT BOOKING (Concurrency Safe)
  // ==========================================

  public async bookAppointment(
    patientUserId: string,
    dto: BookAppointmentDto
  ): Promise<{ appointment: AppointmentResponseDto }> {
    if (!dto.doctorId) {
      throw new AppError('Doctor ID is required', 400);
    }
    if (!dto.appointmentDate) {
      throw new AppError('Appointment date is required (YYYY-MM-DD)', 400);
    }
    if (!dto.timeSlot || !dto.timeSlot.start || !dto.timeSlot.end) {
      throw new AppError('Time slot with start and end time is required', 400);
    }

    const patient = await User.findOne({ _id: patientUserId, isDeleted: false });
    if (!patient) {
      throw new AppError('Patient account not found', 404);
    }

    const { doctor, user: doctorUser } = await this.findDoctorDocument(dto.doctorId);

    // Prevent doctor booking appointment with themselves
    const docUserIdStr = doctorUser._id ? doctorUser._id.toString() : ((doctor.userId as any)._id || doctor.userId).toString();
    if (patient._id.toString() === docUserIdStr) {
      throw new AppError('Doctor cannot book an appointment with themselves', 400);
    }

    const normalizedDate = normalizeDate(dto.appointmentDate);

    // Validate future date/time relative to Asia/Kolkata
    if (isDateInPast(normalizedDate)) {
      throw new AppError('Cannot book an appointment in the past', 400);
    }

    const isToday = isDateToday(normalizedDate);
    const slotStartMinutes = timeToMinutes(dto.timeSlot.start);
    const slotEndMinutes = timeToMinutes(dto.timeSlot.end);

    if (slotStartMinutes >= slotEndMinutes) {
      throw new AppError('Slot start time must be before end time', 400);
    }

    if (isToday) {
      if (isSlotInPast(dto.timeSlot.start)) {
        throw new AppError('Selected time slot has already passed', 400);
      }
    }

    // Validate that slot is within doctor's availability window
    const dayOfWeek = getDayOfWeek(normalizedDate);
    const daySchedule = (doctor.availability || []).find(
      (a) => a.day.toLowerCase() === dayOfWeek.toLowerCase()
    );

    if (!daySchedule || !daySchedule.slots || daySchedule.slots.length === 0) {
      throw new AppError(`Doctor is not available on ${dayOfWeek}s`, 400);
    }

    const isWithinWindow = daySchedule.slots.some((w) => {
      const wStart = timeToMinutes(w.start);
      const wEnd = timeToMinutes(w.end);
      return slotStartMinutes >= wStart && slotEndMinutes <= wEnd;
    });

    if (!isWithinWindow) {
      throw new AppError('Requested time slot falls outside doctor working hours', 400);
    }

    // Check pre-existing booking
    const existingBooking = await Appointment.findOne({
      doctorId: doctor._id,
      appointmentDate: normalizedDate,
      'timeSlot.start': dto.timeSlot.start,
      status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      isDeleted: false
    });

    if (existingBooking) {
      throw new AppError('This appointment time slot is already booked', 409);
    }

    const consultationType = dto.consultationType || ConsultationType.IN_PERSON;
    const hospital = dto.hospital?.trim() || doctor.hospital;

    let appointment: AppointmentDocument;

    try {
      appointment = new Appointment({
        patientId: patient._id,
        doctorId: doctor._id,
        hospital,
        appointmentDate: normalizedDate,
        timeSlot: {
          start: dto.timeSlot.start,
          end: dto.timeSlot.end
        },
        status: AppointmentStatus.CONFIRMED,
        consultationType,
        notes: dto.notes?.trim()
      });

      await appointment.save();
    } catch (err: any) {
      // Catch MongoDB duplicate key error (code 11000) from partial unique compound index
      if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
        throw new AppError('This appointment time slot is already booked. Please select another slot.', 409);
      }
      throw err;
    }

    // Populate for timeline and response
    await appointment.populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    // 1. Health Timeline Integration
    try {
      await timelineService.createOrUpdateTimelineEvent({
        userId: patient._id,
        eventType: TimelineEventType.GENERAL,
        title: 'Doctor Appointment Booked',
        description: `Confirmed ${consultationType.replace('_', ' ')} appointment with Dr. ${doctorUser.firstName} ${doctorUser.lastName} (${doctor.specialization}) at ${hospital} on ${dto.appointmentDate} at ${dto.timeSlot.start}.`,
        date: normalizedDate,
        sourceType: 'manual_record',
        sourceId: appointment._id.toString(),
        metadata: {
          appointmentId: appointment._id.toString(),
          doctorId: doctor._id.toString(),
          doctorName: `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`.trim(),
          specialization: doctor.specialization,
          hospital,
          appointmentDate: normalizedDate,
          timeSlot: dto.timeSlot,
          status: appointment.status
        }
      });
    } catch {
      // Non-blocking timeline failure
    }

    // 2. Notification Hook
    try {
      await notificationHookService.notifyAppointmentBooked(appointment as unknown as AppointmentDocument);
    } catch {
      // Non-blocking notification failure
    }

    return {
      appointment: this.formatAppointmentResponse(appointment)
    };
  }

  // ==========================================
  // 4. PATIENT APPOINTMENTS LIST & DETAIL
  // ==========================================

  public async getPatientAppointments(
    patientUserId: string,
    query: GetAppointmentsQueryDto
  ): Promise<{
    appointments: AppointmentResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit), 10) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      patientId: new Types.ObjectId(patientUserId),
      isDeleted: false
    };

    if (query.status && Object.values(AppointmentStatus).includes(query.status as AppointmentStatus)) {
      filter.status = query.status;
    }

    if (query.upcoming === 'true' || query.upcoming === true) {
      const todayMidnight = getTodayNormalizedDate();
      filter.appointmentDate = { $gte: todayMidnight };
      if (!query.status) {
        filter.status = { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] };
      }
    } else {
      if (query.startDate || query.endDate) {
        const dateFilter: Record<string, unknown> = {};
        if (query.startDate) {
          dateFilter.$gte = normalizeDate(query.startDate);
        }
        if (query.endDate) {
          dateFilter.$lte = normalizeDate(query.endDate);
        }
        filter.appointmentDate = dateFilter;
      }
    }

    const sortOrder = query.upcoming === 'true' || query.upcoming === true ? 1 : -1;

    const [total, appts] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.find(filter)
        .populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
          { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
          { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
        ])
        .sort({ appointmentDate: sortOrder, 'timeSlot.start': sortOrder })
        .skip(skip)
        .limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      appointments: appts.map((a) => this.formatAppointmentResponse(a)),
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  public async getUpcomingAppointments(patientUserId: string): Promise<{
    appointments: AppointmentResponseDto[];
    count: number;
  }> {
    const res = await this.getPatientAppointments(patientUserId, {
      upcoming: true,
      limit: 20
    });
    return {
      appointments: res.appointments,
      count: res.pagination.total
    };
  }

  public async getAppointmentById(
    userId: string,
    userRole: string,
    appointmentId: string
  ): Promise<{ appointment: AppointmentResponseDto }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      isDeleted: false
    }).populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    if (!appt) {
      throw new AppError('Appointment not found', 404);
    }

    // Authorization: User must be the patient or the doctor or an admin
    const patientObjId = (appt.patientId as any)._id || appt.patientId;
    const doctorObj = appt.doctorId as any;
    const doctorUserId = doctorObj?.userId?._id || doctorObj?.userId;

    const isPatientOwner = patientObjId.toString() === userId;
    const isDoctorOwner = doctorUserId && doctorUserId.toString() === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isPatientOwner && !isDoctorOwner && !isAdmin) {
      throw new AppError('You are not authorized to view this appointment', 403);
    }

    return {
      appointment: this.formatAppointmentResponse(appt)
    };
  }

  // ==========================================
  // 5. RESCHEDULE APPOINTMENT
  // ==========================================

  public async rescheduleAppointment(
    patientUserId: string,
    appointmentId: string,
    dto: RescheduleAppointmentDto
  ): Promise<{ appointment: AppointmentResponseDto }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }
    if (!dto.appointmentDate) {
      throw new AppError('New appointment date is required (YYYY-MM-DD)', 400);
    }
    if (!dto.timeSlot || !dto.timeSlot.start || !dto.timeSlot.end) {
      throw new AppError('New time slot with start and end time is required', 400);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      patientId: new Types.ObjectId(patientUserId),
      isDeleted: false
    });

    if (!appt) {
      throw new AppError('Appointment not found', 404);
    }

    if (appt.status === AppointmentStatus.COMPLETED) {
      throw new AppError('Completed appointments cannot be rescheduled', 400);
    }
    if (appt.status === AppointmentStatus.CANCELLED || appt.status === AppointmentStatus.REJECTED) {
      throw new AppError(`Cannot reschedule a ${appt.status} appointment`, 400);
    }

    const { doctor, user: doctorUser } = await this.findDoctorDocument(appt.doctorId.toString());
    const newDate = normalizeDate(dto.appointmentDate);

    // Validate future date/time relative to Asia/Kolkata
    if (isDateInPast(newDate)) {
      throw new AppError('Cannot reschedule to a past date', 400);
    }

    const isToday = isDateToday(newDate);
    const slotStartMinutes = timeToMinutes(dto.timeSlot.start);
    const slotEndMinutes = timeToMinutes(dto.timeSlot.end);

    if (slotStartMinutes >= slotEndMinutes) {
      throw new AppError('Slot start time must be before end time', 400);
    }

    if (isToday) {
      if (isSlotInPast(dto.timeSlot.start)) {
        throw new AppError('Selected time slot has already passed', 400);
      }
    }

    // Verify doctor availability window
    const dayOfWeek = getDayOfWeek(newDate);
    const daySchedule = (doctor.availability || []).find(
      (a) => a.day.toLowerCase() === dayOfWeek.toLowerCase()
    );

    if (!daySchedule || !daySchedule.slots || daySchedule.slots.length === 0) {
      throw new AppError(`Doctor is not available on ${dayOfWeek}s`, 400);
    }

    const isWithinWindow = daySchedule.slots.some((w) => {
      const wStart = timeToMinutes(w.start);
      const wEnd = timeToMinutes(w.end);
      return slotStartMinutes >= wStart && slotEndMinutes <= wEnd;
    });

    if (!isWithinWindow) {
      throw new AppError('Requested time slot falls outside doctor working hours', 400);
    }

    // Check conflict with other bookings
    const conflictBooking = await Appointment.findOne({
      _id: { $ne: appt._id },
      doctorId: doctor._id,
      appointmentDate: newDate,
      'timeSlot.start': dto.timeSlot.start,
      status: { $in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      isDeleted: false
    });

    if (conflictBooking) {
      throw new AppError('The requested new time slot is already booked', 409);
    }

    const oldDate = new Date(appt.appointmentDate);
    const oldSlot = { ...appt.timeSlot };

    appt.appointmentDate = newDate;
    appt.timeSlot = {
      start: dto.timeSlot.start,
      end: dto.timeSlot.end
    };
    if (dto.notes !== undefined) {
      appt.notes = dto.notes.trim();
    }

    try {
      await appt.save();
    } catch (err: any) {
      if (err && (err.code === 11000 || err.name === 'MongoServerError')) {
        throw new AppError('The requested new time slot is already booked', 409);
      }
      throw err;
    }

    await appt.populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    // Timeline event
    try {
      await timelineService.createOrUpdateTimelineEvent({
        userId: new Types.ObjectId(patientUserId),
        eventType: TimelineEventType.GENERAL,
        title: 'Appointment Rescheduled',
        description: `Appointment with Dr. ${doctorUser.firstName} ${doctorUser.lastName} rescheduled to ${dto.appointmentDate} at ${dto.timeSlot.start}.`,
        date: newDate,
        sourceType: 'manual_record',
        sourceId: appt._id.toString(),
        metadata: {
          appointmentId: appt._id.toString(),
          doctorId: doctor._id.toString(),
          oldDate,
          oldSlot,
          newDate,
          newSlot: appt.timeSlot
        }
      });
    } catch {
      // Non-blocking
    }

    // Notification Hook
    try {
      await notificationHookService.notifyAppointmentRescheduled(appt as unknown as AppointmentDocument, oldDate, oldSlot);
    } catch {
      // Non-blocking
    }

    return {
      appointment: this.formatAppointmentResponse(appt)
    };
  }

  // ==========================================
  // 6. CANCEL APPOINTMENT
  // ==========================================

  public async cancelAppointment(
    userId: string,
    userRole: string,
    appointmentId: string,
    dto: CancelAppointmentDto
  ): Promise<{ appointment: AppointmentResponseDto; message: string }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      isDeleted: false
    }).populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    if (!appt) {
      throw new AppError('Appointment not found', 404);
    }

    const patientObjId = (appt.patientId as any)._id || appt.patientId;
    const doctorObj = appt.doctorId as any;
    const doctorUserId = doctorObj?.userId?._id || doctorObj?.userId;

    const isPatient = patientObjId.toString() === userId;
    const isDoctor = doctorUserId && doctorUserId.toString() === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new AppError('You are not authorized to cancel this appointment', 403);
    }

    if (appt.status === AppointmentStatus.CANCELLED) {
      throw new AppError('Appointment is already cancelled', 400);
    }
    if (appt.status === AppointmentStatus.COMPLETED) {
      throw new AppError('Completed appointments cannot be cancelled', 400);
    }
    if (appt.status === AppointmentStatus.REJECTED) {
      throw new AppError('Rejected appointments cannot be cancelled', 400);
    }

    const cancelledBy = isDoctor ? CancelledBy.DOCTOR : CancelledBy.PATIENT;
    const reason = dto.reason?.trim() || `Cancelled by ${cancelledBy}`;

    appt.status = AppointmentStatus.CANCELLED;
    appt.cancelledBy = cancelledBy;
    appt.cancellationReason = reason;
    appt.cancelledAt = new Date();

    await appt.save();

    // Timeline event for patient
    try {
      await timelineService.createOrUpdateTimelineEvent({
        userId: patientObjId,
        eventType: TimelineEventType.GENERAL,
        title: 'Appointment Cancelled',
        description: `Appointment for ${appt.appointmentDate.toISOString().split('T')[0]} at ${appt.timeSlot.start} was cancelled.`,
        date: new Date(),
        sourceType: 'manual_record',
        sourceId: appt._id.toString(),
        metadata: {
          appointmentId: appt._id.toString(),
          cancelledBy,
          reason
        }
      });
    } catch {
      // Non-blocking
    }

    // Notification Hook
    try {
      await notificationHookService.notifyAppointmentCancelled(appt as unknown as AppointmentDocument, cancelledBy, reason);
    } catch {
      // Non-blocking
    }

    return {
      message: 'Appointment cancelled successfully',
      appointment: this.formatAppointmentResponse(appt)
    };
  }

  // ==========================================
  // 7. DOCTOR WORKFLOW (Appointments, Accept, Reject, Complete)
  // ==========================================

  public async getDoctorAppointments(
    doctorUserId: string,
    query: DoctorAppointmentsQueryDto
  ): Promise<{
    appointments: AppointmentResponseDto[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const doctor = await Doctor.findOne({ userId: doctorUserId });
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    const page = Math.max(1, parseInt(String(query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(query.limit), 10) || 10));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      doctorId: doctor._id,
      isDeleted: false
    };

    if (query.status && Object.values(AppointmentStatus).includes(query.status as AppointmentStatus)) {
      filter.status = query.status;
    }

    if (query.date) {
      filter.appointmentDate = normalizeDate(query.date);
    } else if (query.startDate || query.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (query.startDate) {
        dateFilter.$gte = normalizeDate(query.startDate);
      }
      if (query.endDate) {
        dateFilter.$lte = normalizeDate(query.endDate);
      }
      filter.appointmentDate = dateFilter;
    }

    if (query.patientId && Types.ObjectId.isValid(query.patientId)) {
      filter.patientId = new Types.ObjectId(query.patientId);
    }

    const [total, appts] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.find(filter)
        .populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
          { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
          { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
        ])
        .sort({ appointmentDate: 1, 'timeSlot.start': 1 })
        .skip(skip)
        .limit(limit)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      appointments: appts.map((a) => this.formatAppointmentResponse(a)),
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  public async acceptAppointment(
    doctorUserId: string,
    appointmentId: string
  ): Promise<{ appointment: AppointmentResponseDto; message: string }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const doctor = await Doctor.findOne({ userId: doctorUserId });
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      doctorId: doctor._id,
      isDeleted: false
    }).populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    if (!appt) {
      throw new AppError('Appointment not found or not assigned to you', 404);
    }

    if (appt.status === AppointmentStatus.CONFIRMED) {
      return {
        message: 'Appointment is already confirmed',
        appointment: this.formatAppointmentResponse(appt)
      };
    }

    if (appt.status !== AppointmentStatus.PENDING) {
      throw new AppError(`Cannot accept appointment with current status: ${appt.status}`, 400);
    }

    appt.status = AppointmentStatus.CONFIRMED;
    await appt.save();

    // Notification Hook
    try {
      await notificationHookService.notifyAppointmentConfirmed(appt as unknown as AppointmentDocument);
    } catch {
      // Non-blocking
    }

    return {
      message: 'Appointment confirmed successfully',
      appointment: this.formatAppointmentResponse(appt)
    };
  }

  public async rejectAppointment(
    doctorUserId: string,
    appointmentId: string,
    dto: RejectAppointmentDto
  ): Promise<{ appointment: AppointmentResponseDto; message: string }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const doctor = await Doctor.findOne({ userId: doctorUserId });
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      doctorId: doctor._id,
      isDeleted: false
    }).populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    if (!appt) {
      throw new AppError('Appointment not found or not assigned to you', 404);
    }

    if (appt.status !== AppointmentStatus.PENDING) {
      throw new AppError(`Cannot reject appointment with current status: ${appt.status}`, 400);
    }

    const reason = dto.reason?.trim() || 'Declined by doctor';
    appt.status = AppointmentStatus.REJECTED;
    appt.cancelledBy = CancelledBy.DOCTOR;
    appt.cancellationReason = reason;
    appt.cancelledAt = new Date();

    await appt.save();

    // Notification Hook
    try {
      await notificationHookService.notifyAppointmentRejected(appt as unknown as AppointmentDocument, reason);
    } catch {
      // Non-blocking
    }

    return {
      message: 'Appointment rejected successfully',
      appointment: this.formatAppointmentResponse(appt)
    };
  }

  public async completeAppointment(
    doctorUserId: string,
    appointmentId: string
  ): Promise<{ appointment: AppointmentResponseDto; message: string }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const doctor = await Doctor.findOne({ userId: doctorUserId });
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      doctorId: doctor._id,
      isDeleted: false
    }).populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email phone avatar gender bloodGroup dateOfBirth' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    if (!appt) {
      throw new AppError('Appointment not found or not assigned to you', 404);
    }

    if (appt.status === AppointmentStatus.COMPLETED) {
      return {
        message: 'Appointment is already completed',
        appointment: this.formatAppointmentResponse(appt)
      };
    }

    if (appt.status !== AppointmentStatus.CONFIRMED && appt.status !== AppointmentStatus.PENDING) {
      throw new AppError(`Cannot complete appointment with current status: ${appt.status}`, 400);
    }

    appt.status = AppointmentStatus.COMPLETED;
    await appt.save();

    // Timeline event
    try {
      const patientId = (appt.patientId as any)._id || appt.patientId;
      await timelineService.createOrUpdateTimelineEvent({
        userId: patientId,
        eventType: TimelineEventType.DIAGNOSIS_RECORDED,
        title: 'Doctor Consultation Completed',
        description: `Consultation completed with Dr. ${(appt.doctorId as any)?.userId?.firstName || 'Doctor'} at ${appt.hospital}.`,
        date: new Date(),
        sourceType: 'manual_record',
        sourceId: appt._id.toString(),
        metadata: {
          appointmentId: appt._id.toString(),
          doctorId: doctor._id.toString(),
          status: appt.status
        }
      });
    } catch {
      // Non-blocking
    }

    return {
      message: 'Appointment completed successfully',
      appointment: this.formatAppointmentResponse(appt)
    };
  }

  // ==========================================
  // 8. PRESCRIPTION INTEGRATION
  // ==========================================

  public async createPrescription(
    doctorUserId: string,
    appointmentId: string,
    dto: CreatePrescriptionDto
  ): Promise<{ prescription: PrescriptionResponseDto }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const doctor = await Doctor.findOne({ userId: doctorUserId });
    if (!doctor) {
      throw new AppError('Doctor profile not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      doctorId: doctor._id,
      isDeleted: false
    });

    if (!appt) {
      throw new AppError('Appointment not found or not assigned to you', 404);
    }

    if (appt.status === AppointmentStatus.CANCELLED || appt.status === AppointmentStatus.REJECTED) {
      throw new AppError(`Cannot create prescription for a ${appt.status} appointment`, 400);
    }

    if (!Array.isArray(dto.medicines) || dto.medicines.length === 0) {
      throw new AppError('Prescription must include at least one medicine', 400);
    }

    for (const med of dto.medicines) {
      if (!med.name || !med.name.trim()) {
        throw new AppError('Medicine name is required', 400);
      }
      if (!med.dosage || !med.dosage.trim()) {
        throw new AppError(`Dosage is required for medicine: ${med.name}`, 400);
      }
      if (!med.frequency || !med.frequency.trim()) {
        throw new AppError(`Frequency is required for medicine: ${med.name}`, 400);
      }
      if (!med.duration || !med.duration.trim()) {
        throw new AppError(`Duration is required for medicine: ${med.name}`, 400);
      }
    }

    // Check if prescription already exists for this appointment
    let prescription = await Prescription.findOne({
      appointmentId: appt._id,
      isDeleted: false
    });

    let nextVisitDate: Date | undefined;
    if (dto.nextVisit) {
      nextVisitDate = typeof dto.nextVisit === 'string' ? this.normalizeDate(dto.nextVisit) : new Date(dto.nextVisit);
    }

    if (prescription) {
      // Update existing prescription
      prescription.medicines = dto.medicines;
      prescription.instructions = dto.instructions?.trim();
      prescription.nextVisit = nextVisitDate;
      await prescription.save();
    } else {
      prescription = new Prescription({
        appointmentId: appt._id,
        doctorId: doctor._id,
        patientId: appt.patientId,
        medicines: dto.medicines,
        instructions: dto.instructions?.trim(),
        nextVisit: nextVisitDate
      });
      await prescription.save();
    }

    // Link prescription to appointment and mark completed
    appt.prescriptionId = prescription._id;
    appt.status = AppointmentStatus.COMPLETED;
    await appt.save();

    await prescription.populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email gender bloodGroup' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    // Timeline event for patient
    try {
      const doctorUser = await User.findById(doctor.userId);
      const docName = doctorUser ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`.trim() : 'Doctor';

      await timelineService.createOrUpdateTimelineEvent({
        userId: appt.patientId,
        eventType: TimelineEventType.MEDICATION_PRESCRIBED,
        title: 'Digital Prescription Issued',
        description: `Prescription issued by ${docName} containing ${dto.medicines.length} medicine(s).`,
        date: new Date(),
        sourceType: 'manual_record',
        sourceId: prescription._id.toString(),
        metadata: {
          prescriptionId: prescription._id.toString(),
          appointmentId: appt._id.toString(),
          doctorId: doctor._id.toString(),
          medicines: dto.medicines,
          instructions: dto.instructions,
          nextVisit: nextVisitDate
        }
      });
    } catch {
      // Non-blocking
    }

    // Notification Hook
    try {
      await notificationHookService.notifyPrescriptionCreated(prescription, appt as unknown as AppointmentDocument);
    } catch {
      // Non-blocking
    }

    return {
      prescription: this.formatPrescriptionResponse(prescription)
    };
  }

  public async getPrescriptionByAppointment(
    userId: string,
    userRole: string,
    appointmentId: string
  ): Promise<{ prescription: PrescriptionResponseDto }> {
    if (!Types.ObjectId.isValid(appointmentId)) {
      throw new AppError('Appointment not found', 404);
    }

    const appt = await Appointment.findOne({
      _id: new Types.ObjectId(appointmentId),
      isDeleted: false
    });

    if (!appt) {
      throw new AppError('Appointment not found', 404);
    }

    const prescription = await Prescription.findOne({
      appointmentId: appt._id,
      isDeleted: false
    }).populate<{ patientId: UserDocument; doctorId: DoctorDocument }>([
      { path: 'patientId', select: 'firstName lastName email gender bloodGroup' },
      { path: 'doctorId', populate: { path: 'userId', select: 'firstName lastName avatar' } }
    ]);

    if (!prescription) {
      throw new AppError('No prescription found for this appointment', 404);
    }

    // Authorization
    const doctorObj = prescription.doctorId as any;
    const doctorUserId = doctorObj?.userId?._id || doctorObj?.userId;
    const isPatient = (prescription.patientId as any)._id?.toString() === userId || prescription.patientId.toString() === userId;
    const isDoctor = doctorUserId && doctorUserId.toString() === userId;
    const isAdmin = userRole === UserRole.ADMIN;

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new AppError('You are not authorized to view this prescription', 403);
    }

    return {
      prescription: this.formatPrescriptionResponse(prescription)
    };
  }
}

export const appointmentService = new AppointmentService();
