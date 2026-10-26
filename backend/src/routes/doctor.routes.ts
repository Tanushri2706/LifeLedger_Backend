import { Router } from 'express';
import { doctorController, appointmentController } from '../controllers';
import { authenticate, requireRole } from '../middleware';
import { UserRole } from '../types';

const router = Router();

// Doctor routes require both Authentication and Doctor Role
router.use(authenticate, requireRole(UserRole.DOCTOR));

router.get('/me', (req, res, next) => doctorController.getMe(req, res, next));
router.patch('/me', (req, res, next) => doctorController.updateMe(req, res, next));
router.put('/me', (req, res, next) => doctorController.updateMe(req, res, next));
router.get('/me/dashboard', (req, res, next) => doctorController.getDashboard(req, res, next));

// API.md compatibility routes
router.get('/profile', (req, res, next) => doctorController.getMe(req, res, next));
router.post('/profile', (req, res, next) => doctorController.onboardDoctorProfile(req, res, next));
router.put('/profile', (req, res, next) => doctorController.updateMe(req, res, next));

// Availability Management
router.get('/availability', (req, res, next) => appointmentController.getDoctorAvailabilitySchedule(req, res, next));
router.post('/availability', (req, res, next) => appointmentController.updateDoctorAvailability(req, res, next));
router.put('/availability', (req, res, next) => appointmentController.updateDoctorAvailability(req, res, next));

// Doctor Appointments Management
router.get('/appointments', (req, res, next) => appointmentController.getDoctorAppointments(req, res, next));

export const doctorRouter = router;
