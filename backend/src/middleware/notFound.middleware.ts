import { Request, Response } from 'express';
import { sendError } from '../utils';

export const notFoundHandler = (req: Request, res: Response): Response => {
  return sendError(
    res,
    404,
    `Resource not found: ${req.method} ${req.originalUrl}`
  );
};
