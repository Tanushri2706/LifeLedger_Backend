import { Request, Response, NextFunction } from 'express';
import { doctorService, dashboardService } from '../services';
import { sendSuccess } from '../utils';

export class DoctorController {
  // --- Doctor Private Profile & Dashboard Handlers ---

  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.getDoctorProfile(req.user!.id);
      return sendSuccess(res, 200, 'Doctor profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async updateMe(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.updateDoctorProfile(req.user!.id, req.body);
      return sendSuccess(res, 200, 'Doctor profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async onboardDoctorProfile(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.updateDoctorProfile(req.user!.id, req.body);
      return sendSuccess(res, 201, 'Doctor profile created/onboarded successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await dashboardService.getDoctorDashboard(req.user!.id);
      return sendSuccess(res, 200, 'Doctor dashboard data retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // --- Doctor Public Discovery Handlers ---

  public async getDoctors(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.getDoctors(req.query);
      return sendSuccess(res, 200, 'Doctors retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getDoctorById(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await doctorService.getDoctorById(id || '');
      return sendSuccess(res, 200, 'Doctor details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async searchDoctors(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.searchDoctors(req.query);
      return sendSuccess(res, 200, 'Doctor search results retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getSpecializations(_req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.getSpecializations();
      return sendSuccess(res, 200, 'Doctor specializations retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getAvailability(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await doctorService.getDoctorAvailability(req.query);
      return sendSuccess(res, 200, 'Doctor availability retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const doctorController: DoctorController = new DoctorController();
