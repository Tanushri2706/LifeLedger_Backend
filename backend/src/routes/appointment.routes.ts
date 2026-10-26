import { Router } from 'express';
import { appointmentController } from '../controllers';
import { authenticate, requireRole } from '../middleware';
import { UserRole } from '../types';

const router = Router();

// All appointment routes require authentication
router.use(authenticate);

// Specific routes before parameterized :id routes
router.get('/upcoming', (req, res, next) => appointmentController.getUpcomingAppointments(req, res, next));
router.get('/', (req, res, next) => appointmentController.getAppointments(req, res, next));
router.post('/', (req, res, next) => appointmentController.bookAppointment(req, res, next));

// Appointment by ID
router.get('/:id', (req, res, next) => appointmentController.getAppointmentById(req, res, next));
router.put('/:id', (req, res, next) => appointmentController.rescheduleAppointment(req, res, next));
router.delete('/:id', (req, res, next) => appointmentController.cancelAppointment(req, res, next));

// Doctor Workflow on Appointments
router.put('/:id/accept', requireRole(UserRole.DOCTOR), (req, res, next) =>
  appointmentController.acceptAppointment(req, res, next)
);
router.put('/:id/reject', requireRole(UserRole.DOCTOR), (req, res, next) =>
  appointmentController.rejectAppointment(req, res, next)
);
router.put('/:id/complete', requireRole(UserRole.DOCTOR), (req, res, next) =>
  appointmentController.completeAppointment(req, res, next)
);

// Prescriptions
router.post('/:id/prescription', requireRole(UserRole.DOCTOR), (req, res, next) =>
  appointmentController.createPrescription(req, res, next)
);
router.get('/:id/prescription', (req, res, next) => appointmentController.getPrescription(req, res, next));

export const appointmentRouter = router;
