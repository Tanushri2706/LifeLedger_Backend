import { Router } from 'express';
import { familyController } from '../controllers';
import { authenticate } from '../middleware';

const router = Router();

// All Family Vault routes require authenticated LifeLedger user account
router.use(authenticate);

// 1. Family Vault Summary
router.get('/summary', (req, res, next) => familyController.getVaultSummary(req, res, next));

// 2. Managed Family Profiles CRUD & Listing
router.get('/members', (req, res, next) => familyController.getMembers(req, res, next));
router.post('/members', (req, res, next) => familyController.createMember(req, res, next));
router.get('/members/:id', (req, res, next) => familyController.getMemberById(req, res, next));
router.patch('/members/:id', (req, res, next) => familyController.updateMember(req, res, next));
router.delete('/members/:id', (req, res, next) => familyController.archiveMember(req, res, next));
router.post('/members/:id/archive', (req, res, next) => familyController.archiveMember(req, res, next));
router.post('/members/:id/restore', (req, res, next) => familyController.restoreMember(req, res, next));

export const familyRouter = router;
