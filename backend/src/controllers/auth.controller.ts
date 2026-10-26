import { Request, Response, NextFunction } from 'express';
import { authService } from '../services';
import { sendSuccess } from '../utils';
import { config } from '../config';
import { IDeviceInfo } from '../types';

const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production' || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
  maxAge: SEVEN_DAYS_MS,
  path: '/',
  ...(config.cookieDomain ? { domain: config.cookieDomain } : {})
});

const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production' || config.cookieSameSite === 'none',
  sameSite: config.cookieSameSite,
  path: '/',
  ...(config.cookieDomain ? { domain: config.cookieDomain } : {})
});

const setRefreshTokenCookie = (res: Response, refreshToken: string): void => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getCookieOptions());
};

const clearRefreshTokenCookie = (res: Response): void => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, getClearCookieOptions());
};

const extractDeviceInfo = (req: Request): IDeviceInfo => {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1'
  };
};

export class AuthController {
  public async signup(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const deviceInfo = extractDeviceInfo(req);
      const result = await authService.signupUser(req.body, deviceInfo);
      return sendSuccess(
        res,
        201,
        'Account created successfully. A verification code has been dispatched to your email.',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  public async signupDoctor(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const deviceInfo = extractDeviceInfo(req);
      const result = await authService.signupDoctor(req.body, deviceInfo);
      return sendSuccess(
        res,
        201,
        'Doctor account created successfully. A verification code has been dispatched to your email.',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  public async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyEmail(email, otp);
      return sendSuccess(res, 200, 'Email verified successfully. You can now log in.', result);
    } catch (error) {
      next(error);
    }
  }

  public async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const { email, purpose } = req.body;
      const result = await authService.resendOtp(email, purpose);
      return sendSuccess(res, 200, 'A new verification code has been sent if the account exists.', result);
    } catch (error) {
      next(error);
    }
  }

  public async login(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const { email, password, portal } = req.body;
      const deviceInfo = extractDeviceInfo(req);
      const result = await authService.login(email, password, portal, deviceInfo);

      // Store refresh token in secure HttpOnly cookie
      setRefreshTokenCookie(res, result.refreshToken);

      return sendSuccess(res, 200, 'Logged in successfully', {
        user: result.user,
        accessToken: result.accessToken
      });
    } catch (error) {
      next(error);
    }
  }

  public async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
      const deviceInfo = extractDeviceInfo(req);
      const result = await authService.refreshSession(rawRefreshToken, deviceInfo);

      // Rotate refresh token cookie
      setRefreshTokenCookie(res, result.refreshToken);

      return sendSuccess(res, 200, 'Session refreshed successfully', {
        user: result.user,
        accessToken: result.accessToken
      });
    } catch (error) {
      next(error);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;
      await authService.logout(rawRefreshToken);
      clearRefreshTokenCookie(res);
      return sendSuccess(res, 200, 'Logged out successfully', {});
    } catch (error) {
      next(error);
    }
  }

  public async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      return sendSuccess(
        res,
        200,
        'If an account exists with this email, a password reset code has been sent.',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  public async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await authService.resetPassword(req.body);
      clearRefreshTokenCookie(res);
      return sendSuccess(
        res,
        200,
        'Password reset successfully. Please log in with your new password.',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  public async changePassword(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await authService.changePassword(req.user!.id, req.body);
      clearRefreshTokenCookie(res);
      return sendSuccess(
        res,
        200,
        'Password changed successfully. All active sessions have been invalidated. Please log in with your new password.',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  public async getProfile(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      const result = await authService.getUserProfile(req.user!.id);
      return sendSuccess(res, 200, 'Profile retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  }

  public async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void | Response> {
    try {
      await authService.deleteAccount(req.user!.id);
      clearRefreshTokenCookie(res);
      return sendSuccess(res, 200, 'Account deleted successfully', null);
    } catch (error) {
      next(error);
    }
  }

  public async patientTestEndpoint(req: Request, res: Response): Promise<Response> {
    return sendSuccess(res, 200, 'Patient role authorized successfully', {
      user: req.user
    });
  }

  public async doctorTestEndpoint(req: Request, res: Response): Promise<Response> {
    return sendSuccess(res, 200, 'Doctor role authorized successfully', {
      user: req.user
    });
  }
}

export const authController: AuthController = new AuthController();
