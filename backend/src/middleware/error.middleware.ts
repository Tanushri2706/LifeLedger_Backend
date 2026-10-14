import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendError, AppError } from '../utils';

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  const errorDetails: Record<string, unknown> = {};

  // 1. Handle Custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    if (err.error && typeof err.error === 'object') {
      Object.assign(errorDetails, err.error);
    }
  }
  // 2. Handle Body-Parser JSON Syntax Errors (Malformed JSON)
  else if (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as unknown as { status: number }).status === 400 &&
    'body' in err
  ) {
    statusCode = 400;
    message = 'Malformed JSON in request body';
  }
  // 3. Handle Request Entity Too Large
  else if ('type' in err && (err as unknown as { type: string }).type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request payload exceeds allowable size limit';
  }
  // 4. Handle CORS policy errors
  else if (err.message && err.message.startsWith('CORS policy violation')) {
    statusCode = 403;
    message = err.message;
  }
  // 5. Handle Generic Errors
  else if (err instanceof Error) {
    const customStatus = (err as unknown as { statusCode?: number }).statusCode;
    if (typeof customStatus === 'number' && customStatus >= 400 && customStatus < 600) {
      statusCode = customStatus;
    }
    message = config.nodeEnv === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';
  }

  // Include stack traces only in development environment
  if (config.nodeEnv === 'development' && err.stack) {
    errorDetails.stack = err.stack;
  }

  return sendError(res, statusCode, message, errorDetails);
};
