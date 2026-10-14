import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services';
import { sendSuccess } from '../utils';

export class DashboardController {
  public async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await dashboardService.getDashboard(req.user!);
      return sendSuccess(res, 200, 'Dashboard data retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController: DashboardController = new DashboardController();
