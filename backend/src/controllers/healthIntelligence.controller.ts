import { Request, Response, NextFunction } from 'express';
import { aggregateHealthIntelligenceService } from '../services';
import { sendSuccess } from '../utils';

export class HealthIntelligenceController {
  public async getAggregateHealthIntelligence(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const forceRefresh = Boolean(req.query.refresh === 'true' || req.query.forceRefresh === 'true');
      const subjectType = typeof req.query.subjectType === 'string' ? req.query.subjectType : undefined;
      const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined;
      const result = await aggregateHealthIntelligenceService.getAggregateHealthIntelligence(req.user!.id, {
        subjectType,
        subjectId,
        forceRefresh
      });
      return sendSuccess(res, 200, 'Aggregate health intelligence retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const healthIntelligenceController = new HealthIntelligenceController();
