import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;
  const requestId = req.requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const message = `${method} ${originalUrl} -> ${statusCode} (${duration}ms)`;

    if (statusCode >= 500) {
      logger.error(message, undefined, requestId);
    } else if (statusCode >= 400) {
      logger.warn(message, undefined, requestId);
    } else {
      logger.info(message, undefined, requestId);
    }
  });

  next();
}
