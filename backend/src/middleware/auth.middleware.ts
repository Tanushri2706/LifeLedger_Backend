import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import { verifyAccessToken, sendError } from '../utils';

export const authenticate = (req: Request, res: Response, next: NextFunction): void | Response => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication token is required');
  }

  const token = authHeader.split(' ')[1];
  if (!token || !token.trim()) {
    return sendError(res, 401, 'Authentication token is required');
  }

  try {
    const payload = verifyAccessToken(token.trim());
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isVerified: payload.isVerified
    };
    return next();
  } catch (err) {
    const errorMessage =
      err instanceof Error && err.name === 'TokenExpiredError'
        ? 'Authentication token has expired'
        : 'Invalid authentication token';
    return sendError(res, 401, errorMessage);
  }
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  if (!token || !token.trim()) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token.trim());
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      isVerified: payload.isVerified
    };
  } catch {
    // If optional token is invalid or expired, continue without req.user
  }

  return next();
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'Access denied: Insufficient permissions');
    }

    return next();
  };
};
