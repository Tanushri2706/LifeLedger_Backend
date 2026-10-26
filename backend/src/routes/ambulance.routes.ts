import { Router } from 'express';
import { ambulanceController } from '../controllers';

const router = Router();

// Ambulance capabilities contract (real vs mock, telephony vs telematics)
router.get('/capabilities', (req, res, next) => ambulanceController.getCapabilities(req, res, next));

// Supported ambulance types & equipment specifications
router.get('/types', (req, res, next) => ambulanceController.getSupportedTypes(req, res, next));

// Nearby ambulance discovery with geospatial distance sorting and type filtering
router.get('/', (req, res, next) => ambulanceController.getNearbyAmbulances(req, res, next));

// Ambulance details by ID
router.get('/:id', (req, res, next) => ambulanceController.getAmbulanceById(req, res, next));

export const ambulanceRouter = router;

