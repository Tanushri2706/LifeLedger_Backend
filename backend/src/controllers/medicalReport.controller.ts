import { Request, Response, NextFunction } from 'express';
import { medicalReportService } from '../services';
import { sendSuccess } from '../utils';

export class MedicalReportController {
  public async uploadReport(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await medicalReportService.uploadReport(req.user!.id, req.file, req.body);
      return sendSuccess(res, 201, 'Medical report uploaded successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getReports(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await medicalReportService.getReports(req.user!.id, req.query);
      return sendSuccess(res, 200, 'Medical reports retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getReportById(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await medicalReportService.getReportById(req.user!.id, reportId || '');
      return sendSuccess(res, 200, 'Medical report details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async updateReport(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await medicalReportService.updateReport(req.user!.id, reportId || '', req.body);
      return sendSuccess(res, 200, 'Medical report updated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async deleteReport(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await medicalReportService.deleteReport(req.user!.id, reportId || '');
      return sendSuccess(res, 200, 'Medical report deleted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getReportDownload(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await medicalReportService.getReportDownloadUrl(req.user!.id, reportId || '');
      return sendSuccess(res, 200, 'Report download URL generated successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async analyzeReport(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const forceReanalyze = Boolean(req.body?.forceReanalyze);
      const result = await import('../services').then((s) =>
        s.aiHealthAnalysisService.analyzeReport(req.user!.id, reportId || '', { forceReanalyze })
      );
      const status = result.isCached ? 200 : 201;
      return sendSuccess(res, status, 'Medical report analyzed successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getReportAnalysis(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await import('../services').then((s) =>
        s.aiHealthAnalysisService.getReportAnalysis(req.user!.id, reportId || '')
      );
      return sendSuccess(res, 200, 'Report AI analysis retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const medicalReportController: MedicalReportController = new MedicalReportController();
