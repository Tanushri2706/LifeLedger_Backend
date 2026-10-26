import { Request, Response, NextFunction } from 'express';
import { hospitalService } from '../services';
import { sendSuccess } from '../utils';

export class HospitalController {
  public async getHospitals(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await hospitalService.getNearbyHospitals(req.query);
      return sendSuccess(res, 200, 'Healthcare facilities retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getHospitalById(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await hospitalService.getHospitalById(id || '');
      return sendSuccess(res, 200, 'Healthcare facility details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async searchHospitals(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await hospitalService.searchHospitals(req.query);
      return sendSuccess(res, 200, 'Healthcare facility search results retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getDepartments(_req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await hospitalService.getDepartments();
      return sendSuccess(res, 200, 'Hospital departments retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getEmergencyHospitals(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await hospitalService.getEmergencyHospitals(req.query);
      return sendSuccess(res, 200, 'Emergency healthcare facilities retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const hospitalController: HospitalController = new HospitalController();
