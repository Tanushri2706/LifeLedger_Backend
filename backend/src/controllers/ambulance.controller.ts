import { Request, Response, NextFunction } from 'express';
import { ambulanceService } from '../services';
import { sendSuccess } from '../utils';

export class AmbulanceController {
  public async getCapabilities(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const result = ambulanceService.getCapabilities();
      return sendSuccess(res, 200, 'Ambulance service capabilities retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getSupportedTypes(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const result = ambulanceService.getSupportedTypes();
      return sendSuccess(res, 200, 'Supported ambulance types retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getNearbyAmbulances(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const result = await ambulanceService.getNearbyAmbulances(req.query);
      return sendSuccess(res, 200, 'Ambulance units retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getAmbulanceById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const result = await ambulanceService.getAmbulanceById(req.params.id as string);
      return sendSuccess(res, 200, 'Ambulance details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const ambulanceController: AmbulanceController = new AmbulanceController();

