import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response';

export function getHealthStatus(req: Request, res: Response): void {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  };

  sendSuccess(res, healthData, 200);
}
