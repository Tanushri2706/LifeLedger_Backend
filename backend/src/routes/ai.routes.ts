import { Router } from 'express';
import { aiController, timelineController, healthIntelligenceController } from '../controllers';
import { authenticate, aiRateLimiter } from '../middleware';

const router = Router();

// All AI intelligence endpoints require authentication
router.use(authenticate);

// AI Report Analysis & History (matching API.md)
router.post('/analyze', aiRateLimiter, (req, res, next) => aiController.analyzeReport(req, res, next));
router.get('/history', (req, res, next) => aiController.getAnalysisHistory(req, res, next));

// Report-specific AI operations
router.get('/reports/:id', (req, res, next) => aiController.getReportAnalysis(req, res, next));
router.post('/reports/:id/analyze', aiRateLimiter, (req, res, next) => aiController.analyzeReport(req, res, next));

// AI Timeline endpoint (matching API.md line 64: GET /api/v1/ai/timeline)
router.get('/timeline', (req, res, next) => timelineController.getTimeline(req, res, next));

// Aggregate Health Intelligence aliases
router.get('/aggregate', aiRateLimiter, (req, res, next) => healthIntelligenceController.getAggregateHealthIntelligence(req, res, next));
router.get('/health-intelligence', aiRateLimiter, (req, res, next) => healthIntelligenceController.getAggregateHealthIntelligence(req, res, next));

export const aiRouter = router;
