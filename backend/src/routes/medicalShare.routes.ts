import { Router } from 'express';
import { medicalShareController } from '../controllers';
import { authenticate } from '../middleware';

const router = Router();

// ============================================================================
// AUTHENTICATED OWNER MEDICAL SHARE ROUTES
// ============================================================================

// 1. Create fresh Medical Share (generates opaque token)
router.post('/', authenticate, (req, res, next) =>
  medicalShareController.createShare(req, res, next)
);

// 2. List Owner Shares
router.get('/', authenticate, (req, res, next) =>
  medicalShareController.listOwnerShares(req, res, next)
);

// 3. Get Owner Share Detail
router.get('/:id', authenticate, (req, res, next) =>
  medicalShareController.getOwnerShareDetail(req, res, next)
);

// 4. Revoke Active Medical Share
router.post('/:id/revoke', authenticate, (req, res, next) =>
  medicalShareController.revokeShare(req, res, next)
);

export const medicalShareRouter = router;
