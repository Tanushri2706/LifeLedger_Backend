import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { appRouter } from './routes';
import {
  errorHandler,
  notFoundHandler,
  globalRateLimiter,
  requestLogger
} from './middleware';

export const createApp = (): Application => {
  const app: Application = express();

  // Trust 2 proxy hops (Vercel rewrite -> Render proxy -> app) so req.ip is the real client IP
  app.set('trust proxy', 2);

  // 1. Security HTTP Headers
  app.use(helmet());

  // 2. Strict CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, curl) or matching configured CLIENT_URL
        if (!origin || origin === config.clientUrl) {
          callback(null, true);
        } else {
          callback(new Error(`CORS policy violation: Origin ${origin} is not allowed.`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'x-share-session',
        'X-Share-Session',
        'x-emergency-token',
        'X-Emergency-Token',
        'x-device-id',
        'X-Device-Id'
      ],
      exposedHeaders: ['Set-Cookie']
    })
  );

  // 3. Lightweight Request Logging (privacy safe, no credentials/PHI)
  app.use(requestLogger);

  // 4. Global API Rate Limiting (health check is skipped inside the limiter)
  app.use(globalRateLimiter);

  // 5. Body & Cookie Parsing with Strict Payload Limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  // 6. Application Routes
  app.use(appRouter);

  // 7. 404 Catch-All Middleware
  app.use(notFoundHandler);

  // 8. Global Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export const app: Application = createApp();

export default app;