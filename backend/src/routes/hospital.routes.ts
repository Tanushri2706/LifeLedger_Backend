import { Router } from 'express';
import { hospitalController } from '../controllers';

const router = Router();

// Healthcare discovery endpoints (matching API.md)
router.get('/', (req, res, next) => hospitalController.getHospitals(req, res, next));
router.get('/search', (req, res, next) => hospitalController.searchHospitals(req, res, next));
router.get('/departments', (req, res, next) => hospitalController.getDepartments(req, res, next));
router.get('/emergency', (req, res, next) => hospitalController.getEmergencyHospitals(req, res, next));
router.get('/:id', (req, res, next) => hospitalController.getHospitalById(req, res, next));

export const hospitalRouter = router;
