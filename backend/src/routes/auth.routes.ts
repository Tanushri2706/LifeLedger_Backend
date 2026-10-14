import { Router } from 'express';
import { authController, userController } from '../controllers';
import { authenticate, requireRole, authRateLimiter, uploadAvatarSingle } from '../middleware';
import { UserRole } from '../types';

const router = Router();

// Public Authentication Endpoints (Rate Limited)
router.post('/signup', authRateLimiter, (req, res, next) => authController.signup(req, res, next));
router.post('/signup/doctor', authRateLimiter, (req, res, next) => authController.signupDoctor(req, res, next));
router.post('/verify-email', authRateLimiter, (req, res, next) => authController.verifyEmail(req, res, next));
router.post('/resend-otp', authRateLimiter, (req, res, next) => authController.resendOtp(req, res, next));
router.post('/login', authRateLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/refresh-token', (req, res, next) => authController.refreshToken(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.post('/forgot-password', authRateLimiter, (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', authRateLimiter, (req, res, next) => authController.resetPassword(req, res, next));

// Protected Profile & Account Endpoints
router.get('/profile', authenticate, (req, res, next) => authController.getProfile(req, res, next));
router.put('/profile', authenticate, (req, res, next) => userController.updateMe(req, res, next));
router.patch('/profile', authenticate, (req, res, next) => userController.updateMe(req, res, next));
router.post('/profile/avatar', authenticate, uploadAvatarSingle(), (req, res, next) => userController.uploadAvatar(req, res, next));
router.delete('/profile/avatar', authenticate, (req, res, next) => userController.removeAvatar(req, res, next));

// Password & Email Management
router.post('/change-password', authenticate, (req, res, next) => authController.changePassword(req, res, next));
router.post('/email/request-change', authenticate, authRateLimiter, (req, res, next) => userController.requestEmailChange(req, res, next));
router.post('/email/verify-change', authenticate, authRateLimiter, (req, res, next) => userController.verifyEmailChange(req, res, next));

router.delete('/account', authenticate, (req, res, next) => authController.deleteAccount(req, res, next));

// Role Authorization Test Endpoints (Verification only)
router.get(
  '/test/patient',
  authenticate,
  requireRole(UserRole.PATIENT),
  (req, res) => authController.patientTestEndpoint(req, res)
);
router.get(
  '/test/doctor',
  authenticate,
  requireRole(UserRole.DOCTOR),
  (req, res) => authController.doctorTestEndpoint(req, res)
);

export const authRouter = router;
