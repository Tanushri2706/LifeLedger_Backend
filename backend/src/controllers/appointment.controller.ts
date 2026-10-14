import { Request, Response, NextFunction } from 'express';
import { appointmentService } from '../services';
import { sendSuccess } from '../utils';

export class AppointmentController {
  // ==========================================
  // PATIENT APPOINTMENTS
  // ==========================================

  public async bookAppointment(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await appointmentService.bookAppointment(req.user!.id, req.body);
      return sendSuccess(res, 201, 'Appointment booked successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getAppointments(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await appointmentService.getPatientAppointments(req.user!.id, req.query);
      return sendSuccess(res, 200, 'Appointments retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getUpcomingAppointments(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await appointmentService.getUpcomingAppointments(req.user!.id);
      return sendSuccess(res, 200, 'Upcoming appointments retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getAppointmentById(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.getAppointmentById(req.user!.id, req.user!.role, id || '');
      return sendSuccess(res, 200, 'Appointment details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async rescheduleAppointment(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.rescheduleAppointment(req.user!.id, id || '', req.body);
      return sendSuccess(res, 200, 'Appointment rescheduled successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async cancelAppointment(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.cancelAppointment(req.user!.id, req.user!.role, id || '', req.body);
      return sendSuccess(res, 200, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DOCTOR WORKFLOW
  // ==========================================

  public async getDoctorAppointments(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await appointmentService.getDoctorAppointments(req.user!.id, req.query);
      return sendSuccess(res, 200, 'Doctor appointments retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async acceptAppointment(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.acceptAppointment(req.user!.id, id || '');
      return sendSuccess(res, 200, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  public async rejectAppointment(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.rejectAppointment(req.user!.id, id || '', req.body);
      return sendSuccess(res, 200, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  public async completeAppointment(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.completeAppointment(req.user!.id, id || '');
      return sendSuccess(res, 200, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PRESCRIPTION
  // ==========================================

  public async createPrescription(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.createPrescription(req.user!.id, id || '', req.body);
      return sendSuccess(res, 201, 'Prescription created successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getPrescription(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.getPrescriptionByAppointment(req.user!.id, req.user!.role, id || '');
      return sendSuccess(res, 200, 'Prescription retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // AVAILABILITY & SLOTS
  // ==========================================

  public async updateDoctorAvailability(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await appointmentService.updateDoctorAvailability(
        req.user!.id,
        Array.isArray(req.body) ? req.body : req.body.availability
      );
      return sendSuccess(res, 200, 'Doctor availability updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getDoctorAvailabilitySchedule(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) || req.user?.id;
      const result = await appointmentService.getDoctorAvailabilitySchedule(id || '');
      return sendSuccess(res, 200, 'Doctor availability schedule retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getAvailableSlots(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await appointmentService.getAvailableSlots(id || '', {
        date: String(req.query.date || ''),
        durationMinutes: req.query.durationMinutes ? String(req.query.durationMinutes) : undefined
      });
      return sendSuccess(res, 200, 'Available slots calculated successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
