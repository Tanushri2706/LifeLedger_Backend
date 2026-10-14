import { Router } from 'express';
import { dashboardController } from '../controllers';
import { authenticate } from '../middleware';

const router = Router();

router.get('/', authenticate, (req, res, next) => dashboardController.getDashboard(req, res, next));

export const dashboardRouter = router;
