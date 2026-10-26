import { Request, Response, NextFunction } from 'express';
import { userService, dashboardService } from '../services';
import { sendSuccess } from '../utils';

export class UserController {
  public async getMe(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await userService.getProfile(req.user!.id);
      return sendSuccess(res, 200, 'Profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async updateMe(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await userService.updateProfile(req.user!.id, req.body);
      return sendSuccess(res, 200, 'Profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await userService.uploadAvatar(req.user!.id, req.file);
      return sendSuccess(res, 200, 'Profile photo updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async removeAvatar(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await userService.removeAvatar(req.user!.id);
      return sendSuccess(res, 200, 'Profile photo removed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async requestEmailChange(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await userService.requestEmailChange(req.user!.id, req.body.newEmail);
      return sendSuccess(res, 200, result.message, result);
    } catch (error) {
      next(error);
    }
  }

  public async verifyEmailChange(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await userService.verifyEmailChange(req.user!.id, req.body.newEmail, req.body.otp);
      return sendSuccess(res, 200, 'Email address updated successfully. Please log in again.', result);
    } catch (error) {
      next(error);
    }
  }

  public async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await dashboardService.getUserDashboard(req.user!.id);
      return sendSuccess(res, 200, 'User dashboard data retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const userController: UserController = new UserController();
