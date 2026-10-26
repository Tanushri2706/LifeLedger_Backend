import { Request, Response, NextFunction } from 'express';
import { emergencyService } from '../services';
import { sendSuccess, AppError } from '../utils';

export class EmergencyController {
  // =========================================================================
  // 0. CAPABILITIES
  // =========================================================================

  public async getCapabilities(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const result = emergencyService.getCapabilities();
      return sendSuccess(res, 200, 'Emergency service capabilities retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 1. EMERGENCY CONTACTS
  // =========================================================================

  public async getContacts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.getContacts(req.user.id);
      return sendSuccess(res, 200, 'Emergency contacts retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async createContact(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.createContact(req.user.id, req.body);
      return sendSuccess(res, 201, 'Emergency contact created successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async updateContact(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.updateContact(
        req.user.id,
        req.params.id as string,
        req.body
      );
      return sendSuccess(res, 200, 'Emergency contact updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async deleteContact(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      await emergencyService.deleteContact(req.user.id, req.params.id as string);
      return sendSuccess(res, 200, 'Emergency contact deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 2. EMERGENCY INFORMATION
  // =========================================================================

  public async getEmergencyInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.getEmergencyInfo(req.user.id);
      return sendSuccess(res, 200, 'Emergency medical profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async updateEmergencyInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.updateEmergencyInfo(req.user.id, req.body);
      return sendSuccess(res, 200, 'Emergency medical profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 3. EMERGENCY QR & PUBLIC LOOKUP
  // =========================================================================

  public async getEmergencyQR(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.getEmergencyQR(req.user.id);
      return sendSuccess(res, 200, 'Emergency QR generated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async rotateEmergencyQR(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.rotateEmergencyQR(req.user.id);
      return sendSuccess(res, 200, 'Emergency QR token rotated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Public or Authenticated Emergency Info Lookup.
   * If token is provided in query (?token=XYZ) or path (:token), performs public scanner lookup.
   * If no token provided but authenticated, returns current user's emergency info.
   */
  public async getPublicEmergencyInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const token = (req.query.token as string) || (req.params.token as string);

      if (token) {
        const result = await emergencyService.getPublicEmergencyInfoByToken(token);
        return sendSuccess(res, 200, 'Emergency medical card retrieved successfully', result);
      }

      // If user is authenticated, return their own emergency profile
      if (req.user && req.user.id) {
        const result = await emergencyService.getEmergencyInfo(req.user.id);
        return sendSuccess(res, 200, 'Emergency medical profile retrieved successfully', result);
      }

      throw new AppError('Emergency QR token is required (e.g. ?token=...)', 400);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 4. EMERGENCY ACTIONS & SOS
  // =========================================================================

  public async getEmergencyActions(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const result = emergencyService.getEmergencyActions();
      return sendSuccess(res, 200, 'Emergency actions metadata retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async shareEmergencyInfo(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.shareEmergencyInfo(req.user.id, req.body);
      return sendSuccess(res, 200, 'Emergency information shared successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async triggerSOS(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await emergencyService.triggerSOS(req.user.id, req.body);
      return sendSuccess(res, 201, 'SOS event recorded successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const emergencyController: EmergencyController = new EmergencyController();

