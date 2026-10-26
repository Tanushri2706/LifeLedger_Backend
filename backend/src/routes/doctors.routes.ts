import { Router } from 'express';
import { doctorController, appointmentController } from '../controllers';

const router = Router();

// Doctor Public Discovery Endpoints (matching API.md)
router.get('/', (req, res, next) => doctorController.getDoctors(req, res, next));
router.get('/search', (req, res, next) => doctorController.searchDoctors(req, res, next));
router.get('/specializations', (req, res, next) => doctorController.getSpecializations(req, res, next));
router.get('/availability', (req, res, next) => doctorController.getAvailability(req, res, next));
router.get('/:id/slots', (req, res, next) => appointmentController.getAvailableSlots(req, res, next));
router.get('/:id/availability', (req, res, next) => appointmentController.getDoctorAvailabilitySchedule(req, res, next));
router.get('/:id', (req, res, next) => doctorController.getDoctorById(req, res, next));

export const doctorsRouter = router;
