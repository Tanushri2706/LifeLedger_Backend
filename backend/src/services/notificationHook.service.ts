import { AppointmentDocument, PrescriptionDocument } from '../models';
import { IAppointmentTimeSlot } from '../types';

export interface INotificationPayload {
  type: string;
  recipientId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

export class NotificationHookService {
  private notificationsLog: INotificationPayload[] = [];

  /**
   * Hook triggered when a patient books an appointment.
   */
  public async notifyAppointmentBooked(appointment: AppointmentDocument): Promise<void> {
    const payload: INotificationPayload = {
      type: 'APPOINTMENT_BOOKED',
      recipientId: appointment.patientId.toString(),
      title: 'Appointment Booked',
      message: `Your appointment with Doctor is scheduled for ${appointment.appointmentDate.toISOString().split('T')[0]} at ${appointment.timeSlot.start}.`,
      data: {
        appointmentId: appointment._id.toString(),
        doctorId: appointment.doctorId.toString(),
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        status: appointment.status
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  /**
   * Hook triggered when a doctor accepts/confirms an appointment.
   */
  public async notifyAppointmentConfirmed(appointment: AppointmentDocument): Promise<void> {
    const payload: INotificationPayload = {
      type: 'APPOINTMENT_CONFIRMED',
      recipientId: appointment.patientId.toString(),
      title: 'Appointment Confirmed',
      message: `Your appointment for ${appointment.appointmentDate.toISOString().split('T')[0]} at ${appointment.timeSlot.start} has been confirmed.`,
      data: {
        appointmentId: appointment._id.toString(),
        doctorId: appointment.doctorId.toString(),
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        status: appointment.status
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  /**
   * Hook triggered when an appointment is rejected by the doctor.
   */
  public async notifyAppointmentRejected(
    appointment: AppointmentDocument,
    reason?: string
  ): Promise<void> {
    const payload: INotificationPayload = {
      type: 'APPOINTMENT_REJECTED',
      recipientId: appointment.patientId.toString(),
      title: 'Appointment Declined',
      message: reason
        ? `Your appointment request for ${appointment.appointmentDate.toISOString().split('T')[0]} was declined: ${reason}`
        : `Your appointment request for ${appointment.appointmentDate.toISOString().split('T')[0]} was declined by the doctor.`,
      data: {
        appointmentId: appointment._id.toString(),
        doctorId: appointment.doctorId.toString(),
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        reason
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  /**
   * Hook triggered when an appointment is cancelled by either patient or doctor.
   */
  public async notifyAppointmentCancelled(
    appointment: AppointmentDocument,
    cancelledBy: string,
    reason?: string
  ): Promise<void> {
    const recipientId =
      cancelledBy === 'patient'
        ? appointment.doctorId.toString()
        : appointment.patientId.toString();

    const payload: INotificationPayload = {
      type: 'APPOINTMENT_CANCELLED',
      recipientId,
      title: 'Appointment Cancelled',
      message: `The appointment scheduled for ${appointment.appointmentDate.toISOString().split('T')[0]} at ${appointment.timeSlot.start} was cancelled.`,
      data: {
        appointmentId: appointment._id.toString(),
        cancelledBy,
        reason
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  /**
   * Hook triggered when an appointment is rescheduled.
   */
  public async notifyAppointmentRescheduled(
    appointment: AppointmentDocument,
    oldDate: Date,
    oldSlot: IAppointmentTimeSlot
  ): Promise<void> {
    const payload: INotificationPayload = {
      type: 'APPOINTMENT_RESCHEDULED',
      recipientId: appointment.patientId.toString(),
      title: 'Appointment Rescheduled',
      message: `Your appointment has been rescheduled from ${oldDate.toISOString().split('T')[0]} (${oldSlot.start}) to ${appointment.appointmentDate.toISOString().split('T')[0]} (${appointment.timeSlot.start}).`,
      data: {
        appointmentId: appointment._id.toString(),
        doctorId: appointment.doctorId.toString(),
        oldDate,
        oldSlot,
        newDate: appointment.appointmentDate,
        newSlot: appointment.timeSlot
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  /**
   * Hook triggered when a prescription is created.
   */
  public async notifyPrescriptionCreated(
    prescription: PrescriptionDocument,
    appointment: AppointmentDocument
  ): Promise<void> {
    const payload: INotificationPayload = {
      type: 'PRESCRIPTION_CREATED',
      recipientId: prescription.patientId.toString(),
      title: 'Digital Prescription Available',
      message: `A new prescription has been added for your consultation on ${appointment.appointmentDate.toISOString().split('T')[0]}.`,
      data: {
        prescriptionId: prescription._id.toString(),
        appointmentId: appointment._id.toString(),
        doctorId: prescription.doctorId.toString(),
        medicinesCount: prescription.medicines.length
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  /**
   * Hook interface for upcoming appointment reminders.
   */
  public async notifyUpcomingReminder(appointment: AppointmentDocument): Promise<void> {
    const payload: INotificationPayload = {
      type: 'UPCOMING_APPOINTMENT_REMINDER',
      recipientId: appointment.patientId.toString(),
      title: 'Upcoming Appointment Reminder',
      message: `Reminder: You have an upcoming appointment scheduled for ${appointment.appointmentDate.toISOString().split('T')[0]} at ${appointment.timeSlot.start}.`,
      data: {
        appointmentId: appointment._id.toString(),
        doctorId: appointment.doctorId.toString(),
        timeSlot: appointment.timeSlot
      },
      createdAt: new Date()
    };

    this.notificationsLog.push(payload);
  }

  public getRecentNotificationLogs(): INotificationPayload[] {
    return [...this.notificationsLog];
  }

  public clearLogs(): void {
    this.notificationsLog = [];
  }
}

export const notificationHookService = new NotificationHookService();
