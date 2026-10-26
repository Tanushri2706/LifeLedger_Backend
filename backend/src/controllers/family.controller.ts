import { Request, Response, NextFunction } from 'express';
import { familyService } from '../services';
import { sendSuccess, AppError } from '../utils';

export class FamilyController {
  // =========================================================================
  // 1. CREATE MANAGED FAMILY PROFILE
  // =========================================================================

  public async createMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await familyService.createMember(req.user.id, req.body);
      return sendSuccess(res, 201, 'Family member profile created successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 2. LIST MANAGED FAMILY PROFILES
  // =========================================================================

  public async getMembers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await familyService.getMembers(req.user.id, req.query as any);
      return sendSuccess(res, 200, 'Family members retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 3. GET SINGLE FAMILY MEMBER DETAILS
  // =========================================================================

  public async getMemberById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const memberId = (req.params.id || req.params.memberId) as string;
      const result = await familyService.getMemberById(req.user.id, memberId);
      return sendSuccess(res, 200, 'Family member profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 4. UPDATE MANAGED FAMILY PROFILE
  // =========================================================================

  public async updateMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const memberId = (req.params.id || req.params.memberId) as string;
      const result = await familyService.updateMember(req.user.id, memberId, req.body);
      return sendSuccess(res, 200, 'Family member profile updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 5. ARCHIVE MANAGED FAMILY PROFILE
  // =========================================================================

  public async archiveMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const memberId = (req.params.id || req.params.memberId) as string;
      const result = await familyService.archiveMember(req.user.id, memberId);
      return sendSuccess(res, 200, result.message, { member: result.member });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 6. RESTORE ARCHIVED MANAGED FAMILY PROFILE
  // =========================================================================

  public async restoreMember(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const memberId = (req.params.id || req.params.memberId) as string;
      const result = await familyService.restoreMember(req.user.id, memberId);
      return sendSuccess(res, 200, result.message, { member: result.member });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 7. FAMILY VAULT SUMMARY
  // =========================================================================

  public async getVaultSummary(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await familyService.getVaultSummary(req.user.id);
      return sendSuccess(res, 200, 'Family vault summary retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const familyController: FamilyController = new FamilyController();
