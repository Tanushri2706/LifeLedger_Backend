import { Router } from 'express';
import { userController, authController } from '../controllers';
import { authenticate, uploadAvatarSingle, authRateLimiter } from '../middleware';

const router = Router();

// Profile CRUD
router.get('/me', authenticate, (req, res, next) => userController.getMe(req, res, next));
router.patch('/me', authenticate, (req, res, next) => userController.updateMe(req, res, next));
router.put('/me', authenticate, (req, res, next) => userController.updateMe(req, res, next));

// Avatar / Profile Photo Management
router.post('/me/avatar', authenticate, uploadAvatarSingle(), (req, res, next) => userController.uploadAvatar(req, res, next));
router.delete('/me/avatar', authenticate, (req, res, next) => userController.removeAvatar(req, res, next));

// Password Management (Authenticated)
router.post('/me/change-password', authenticate, (req, res, next) => authController.changePassword(req, res, next));

// Verified Email Change
router.post('/me/email/request-change', authenticate, authRateLimiter, (req, res, next) => userController.requestEmailChange(req, res, next));
router.post('/me/email/verify-change', authenticate, authRateLimiter, (req, res, next) => userController.verifyEmailChange(req, res, next));

export const userRouter = router;
