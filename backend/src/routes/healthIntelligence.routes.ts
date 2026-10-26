import { Router } from 'express';
import { healthIntelligenceController } from '../controllers';
import { authenticate, aiRateLimiter } from '../middleware';

const router = Router();

// All aggregate health intelligence endpoints require authentication
router.use(authenticate);

// GET /api/v1/health-intelligence
router.get('/', aiRateLimiter, (req, res, next) => healthIntelligenceController.getAggregateHealthIntelligence(req, res, next));

export const healthIntelligenceRouter = router;
