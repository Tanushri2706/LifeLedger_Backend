import { Response } from 'express';
import { ApiResponse } from '../types';

export const sendSuccess = <T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T
): Response => {
  const responsePayload: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined ? { data } : { data: {} as T })
  };

  return res.status(statusCode).json(responsePayload);
};

export const sendError = (
  res: Response,
  statusCode: number,
  message: string,
  error: Record<string, unknown> = {}
): Response => {
  const responsePayload: ApiResponse = {
    success: false,
    message,
    error
  };

  return res.status(statusCode).json(responsePayload);
};
