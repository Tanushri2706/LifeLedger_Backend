import { Request, Response, NextFunction } from 'express';
import { medicalShareService } from '../services';
import { sendSuccess, AppError } from '../utils';

export class MedicalShareController {
  // =========================================================================
  // 1. CREATE MEDICAL SHARE (AUTHENTICATED OWNER)
  // =========================================================================

  public async createShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await medicalShareService.createShare(req.user.id, req.body);
      return sendSuccess(res, 201, 'Medical share created successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 2. PUBLIC SHARE LANDING METADATA (NON-CONSUMING GET)
  // =========================================================================

  public async getPublicMetadata(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const token = req.params.token as string;
      const result = await medicalShareService.getPublicShareMetadata(token);
      return sendSuccess(res, 200, 'Medical share metadata retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 3. EXPLICIT RECIPIENT ACCESS ACTIVATION
  // =========================================================================

  public async accessPublicShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const token = req.params.token as string;
      const result = await medicalShareService.accessPublicShare(token);
      return sendSuccess(res, 200, 'Medical share access granted', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 4. SESSION-PROTECTED RECIPIENT REPORT LIST
  // =========================================================================

  public async getSessionReports(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const sessionToken =
        (req.headers['x-share-session'] as string) ||
        (req.query.sessionToken as string) ||
        (req.query.token as string) ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.substring(7)
          : undefined);

      if (!sessionToken) {
        throw new AppError('Session token required in x-share-session header or query', 401);
      }

      const result = await medicalShareService.getReportsForSession(sessionToken);
      return sendSuccess(res, 200, 'Shared medical reports retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 5. SESSION-PROTECTED RECIPIENT DOCUMENT DOWNLOAD
  // =========================================================================

  public async getSessionReportDownload(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      const sessionToken =
        (req.headers['x-share-session'] as string) ||
        (req.query.sessionToken as string) ||
        (req.query.token as string) ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.substring(7)
          : undefined);

      if (!sessionToken) {
        throw new AppError('Session token required in x-share-session header or query', 401);
      }

      const reportId = req.params.reportId as string;
      const result = await medicalShareService.getReportDownloadForSession(sessionToken, reportId);
      return sendSuccess(res, 200, 'Download URL generated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 6. REVOKE MEDICAL SHARE (AUTHENTICATED OWNER)
  // =========================================================================

  public async revokeShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const shareId = (req.params.id || req.params.shareId) as string;
      const result = await medicalShareService.revokeShare(req.user.id, shareId);
      return sendSuccess(res, 200, 'Medical share revoked successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 7. LIST OWNER SHARES (AUTHENTICATED OWNER)
  // =========================================================================

  public async listOwnerShares(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const result = await medicalShareService.listOwnerShares(req.user.id, req.query as any);
      return sendSuccess(res, 200, 'Medical shares retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // 8. GET OWNER SHARE DETAIL (AUTHENTICATED OWNER)
  // =========================================================================

  public async getOwnerShareDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void | Response> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError('Authentication required', 401);
      }
      const shareId = (req.params.id || req.params.shareId) as string;
      const result = await medicalShareService.getOwnerShareDetail(req.user.id, shareId);
      return sendSuccess(res, 200, 'Medical share details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const medicalShareController: MedicalShareController = new MedicalShareController();
