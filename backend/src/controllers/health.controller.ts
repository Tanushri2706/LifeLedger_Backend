import { Request, Response } from 'express';
import { sendSuccess } from '../utils';
import { isDatabaseConnected } from '../config';
import { ApiResponse } from '../types';

export interface HealthCheckData {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  database: 'connected' | 'disconnected';
}

export const getHealth = (_req: Request, res: Response): Response => {
  const dbConnected = isDatabaseConnected();

  const healthData: HealthCheckData = {
    status: dbConnected ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbConnected ? 'connected' : 'disconnected'
  };

  if (!dbConnected) {
    const responsePayload: ApiResponse<HealthCheckData> = {
      success: false,
      message: 'LifeLedger API is operating in a degraded state: database is disconnected',
      data: healthData
    };
    return res.status(503).json(responsePayload);
  }

  return sendSuccess<HealthCheckData>(res, 200, 'LifeLedger API is healthy and operational', healthData);
};
