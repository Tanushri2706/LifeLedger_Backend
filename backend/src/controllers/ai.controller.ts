import { Request, Response, NextFunction } from 'express';
import { aiHealthAnalysisService } from '../services';
import { sendSuccess, AppError } from '../utils';

export class AIController {
  public async analyzeReport(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = req.body?.reportId || (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
      if (!reportId) {
        throw new AppError('reportId is required for AI analysis', 400);
      }

      const forceReanalyze = Boolean(req.body?.forceReanalyze);
      const result = await aiHealthAnalysisService.analyzeReport(req.user!.id, reportId, { forceReanalyze });

      const status = result.isCached ? 200 : 201;
      const message = result.isCached
        ? 'Retrieved existing completed AI analysis'
        : 'Medical report analyzed successfully by AI Health Intelligence';

      return sendSuccess(res, status, message, result);
    } catch (error) {
      next(error);
    }
  }

  public async getReportAnalysis(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const reportId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!reportId) {
        throw new AppError('reportId is required', 400);
      }

      const result = await aiHealthAnalysisService.getReportAnalysis(req.user!.id, reportId);
      return sendSuccess(res, 200, 'Report AI analysis retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getAnalysisHistory(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await aiHealthAnalysisService.getAnalysisHistory(req.user!.id, req.query);
      return sendSuccess(res, 200, 'AI analysis history retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const aiController: AIController = new AIController();
