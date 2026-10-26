import { Router } from 'express';
import { medicalShareController } from '../controllers';
import { publicShareRateLimiter } from '../middleware';

const router = Router();

// ============================================================================
// PUBLIC RECIPIENT MEDICAL SHARE ROUTES (UNAUTHENTICATED)
// ============================================================================

// 1. Session-Protected Document Operations (registered before :token to avoid route masking)
router.get('/session/reports', publicShareRateLimiter, (req, res, next) =>
  medicalShareController.getSessionReports(req, res, next)
);

router.get('/session/reports/:reportId/download', publicShareRateLimiter, (req, res, next) =>
  medicalShareController.getSessionReportDownload(req, res, next)
);

// 2. Public Landing Metadata (Non-Consuming GET)
router.get('/:token', publicShareRateLimiter, (req, res, next) =>
  medicalShareController.getPublicMetadata(req, res, next)
);

// 3. Explicit Recipient Access Activation (Consumes One-Time Token)
router.post('/:token/access', publicShareRateLimiter, (req, res, next) =>
  medicalShareController.accessPublicShare(req, res, next)
);

export const publicMedicalShareRouter = router;
