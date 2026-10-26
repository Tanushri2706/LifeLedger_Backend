import { Router } from 'express';
import { emergencyController, ambulanceController } from '../controllers';
import { authenticate, optionalAuthenticate } from '../middleware';

const router = Router();

// 0. Emergency Capabilities Contract
router.get('/capabilities', (req, res, next) =>
  emergencyController.getCapabilities(req, res, next)
);

// 1. Emergency QR & Public Lookup
router.get('/qr', authenticate, (req, res, next) =>
  emergencyController.getEmergencyQR(req, res, next)
);
router.post('/qr/rotate', authenticate, (req, res, next) =>
  emergencyController.rotateEmergencyQR(req, res, next)
);
router.get('/info', optionalAuthenticate, (req, res, next) =>
  emergencyController.getPublicEmergencyInfo(req, res, next)
);
router.get('/info/:token', optionalAuthenticate, (req, res, next) =>
  emergencyController.getPublicEmergencyInfo(req, res, next)
);

// 2. Emergency Information & Profile (Authenticated)
router.get('/profile', authenticate, (req, res, next) =>
  emergencyController.getEmergencyInfo(req, res, next)
);
router.put('/profile', authenticate, (req, res, next) =>
  emergencyController.updateEmergencyInfo(req, res, next)
);

// 3. Emergency Contacts CRUD (Authenticated)
router.get('/contacts', authenticate, (req, res, next) =>
  emergencyController.getContacts(req, res, next)
);
router.post('/contacts', authenticate, (req, res, next) =>
  emergencyController.createContact(req, res, next)
);
router.put('/contacts/:id', authenticate, (req, res, next) =>
  emergencyController.updateContact(req, res, next)
);
router.delete('/contacts/:id', authenticate, (req, res, next) =>
  emergencyController.deleteContact(req, res, next)
);

// 4. Emergency Actions & SOS (Safe Intent Metadata)
router.get('/actions', (req, res, next) =>
  emergencyController.getEmergencyActions(req, res, next)
);
router.post('/share', authenticate, (req, res, next) =>
  emergencyController.shareEmergencyInfo(req, res, next)
);
router.post('/sos', authenticate, (req, res, next) =>
  emergencyController.triggerSOS(req, res, next)
);

// 5. Emergency Ambulances Discovery
router.get('/ambulances', (req, res, next) =>
  ambulanceController.getNearbyAmbulances(req, res, next)
);

export const emergencyRouter = router;

