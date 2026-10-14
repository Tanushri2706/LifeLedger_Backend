import { Router } from 'express';
import { timelineController } from '../controllers';
import { authenticate } from '../middleware';

const router = Router();

// All timeline endpoints require authentication
router.use(authenticate);

// Timeline endpoints (chronological retrieval, filtering, pagination)
router.get('/', (req, res, next) => timelineController.getTimeline(req, res, next));
router.get('/:id', (req, res, next) => timelineController.getTimelineEventById(req, res, next));

export const timelineRouter = router;
