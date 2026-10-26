import { Router } from 'express';
import { medicalReportController } from '../controllers';
import { authenticate, uploadRateLimiter, uploadSingle, aiRateLimiter } from '../middleware';

const router = Router();

// All medical report endpoints require authentication
router.use(authenticate);

// Upload Report Endpoints
router.post('/', uploadRateLimiter, uploadSingle('file'), (req, res, next) =>
  medicalReportController.uploadReport(req, res, next)
);
router.post('/upload', uploadRateLimiter, uploadSingle('file'), (req, res, next) =>
  medicalReportController.uploadReport(req, res, next)
);

// Report Listing & Querying
router.get('/', (req, res, next) => medicalReportController.getReports(req, res, next));
router.get('/search', (req, res, next) => medicalReportController.getReports(req, res, next));
router.get('/filter', (req, res, next) => medicalReportController.getReports(req, res, next));
router.get('/history', (req, res, next) => medicalReportController.getReports(req, res, next));

// Report Operations by ID
router.get('/:id', (req, res, next) => medicalReportController.getReportById(req, res, next));
router.put('/:id', (req, res, next) => medicalReportController.updateReport(req, res, next));
router.patch('/:id', (req, res, next) => medicalReportController.updateReport(req, res, next));
router.delete('/:id', (req, res, next) => medicalReportController.deleteReport(req, res, next));
router.get('/:id/download', (req, res, next) => medicalReportController.getReportDownload(req, res, next));
router.post('/:id/analyze', aiRateLimiter, (req, res, next) => medicalReportController.analyzeReport(req, res, next));
router.get('/:id/analysis', (req, res, next) => medicalReportController.getReportAnalysis(req, res, next));

export const medicalReportRouter = router;
