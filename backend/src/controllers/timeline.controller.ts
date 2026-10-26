import { Request, Response, NextFunction } from 'express';
import { timelineService } from '../services';
import { sendSuccess } from '../utils';

export class TimelineController {
  public async getTimeline(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await timelineService.getTimeline(req.user!.id, req.query);
      return sendSuccess(res, 200, 'Health timeline retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async getTimelineEventById(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const eventId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await timelineService.getTimelineEventById(req.user!.id, eventId || '');
      return sendSuccess(res, 200, 'Timeline event details retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export const timelineController: TimelineController = new TimelineController();
