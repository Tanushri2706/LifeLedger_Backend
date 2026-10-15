import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendError } from '../utils';

export const createRateLimiter = (customOptions: Partial<Options> = {}) => {
  return rateLimit({
    windowMs: customOptions.windowMs ?? 15 * 60 * 1000, // 15 minutes default
    limit: customOptions.limit ?? customOptions.max ?? 100, // 100 requests default
    standardHeaders: 'draft-7', // combined `RateLimit` header conforming to RFC draft-7
    legacyHeaders: false, // disable X-RateLimit-* headers
    keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || '127.0.0.1',
    handler: (_req: Request, res: Response, _next, options) => {
      const message =
        typeof options.message === 'string'
          ? options.message
          : 'Too many requests from this IP, please try again after 15 minutes.';

      return sendError(res, options.statusCode || 429, message, {});
    },
    ...customOptions
  });
};

export const globalRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  // Health checks (Render + UptimeRobot) must never be rate limited
  skip: (req: Request) => req.originalUrl.startsWith('/api/v1/health'),
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// Stricter rate limiter for sensitive authentication endpoints (mitigate brute force attacks)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20, // 20 requests per 15 minutes per IP
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
});

// Rate limiter for file uploads
export const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30, // 30 uploads per 15 minutes per IP
  message: 'Upload rate limit exceeded. Please try again later.'
});

// Rate limiter for public medical share endpoints (mitigate token brute-force and scraping)
export const publicShareRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60, // 60 requests per 15 minutes per IP
  message: 'Too many requests to medical share service. Please try again later.'
});

// Stricter rate limiter for expensive AI & LLM operations (mitigate provider quota exhaustion & billing spikes)
export const aiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 15, // 15 requests per 15 minutes per authenticated user / IP
  keyGenerator: (req: Request) => req.user?.id || req.ip || req.socket.remoteAddress || '127.0.0.1',
  message: 'AI Health Intelligence rate limit exceeded. Please try again after 15 minutes.'
});