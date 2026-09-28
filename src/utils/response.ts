import { Response } from 'express';
import { ErrorPayload, SuccessResponse, Warning } from '../types/api';

export function createMeta(requestId: string, warnings?: Warning[]) {
  return {
    timestamp: new Date().toISOString(),
    requestId: requestId || 'unknown',
    ...(warnings && warnings.length > 0 ? { warnings } : {}),
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  warnings?: Warning[]
): Response {
  const requestId = (res.req as { requestId?: string }).requestId || 'unknown';
  const responseBody: SuccessResponse<T> = {
    success: true,
    data,
    meta: createMeta(requestId, warnings),
  };
  return res.status(statusCode).json(responseBody);
}

export function sendError(
  res: Response,
  statusCode: number,
  errorPayload: ErrorPayload
): Response {
  const requestId = (res.req as { requestId?: string }).requestId || 'unknown';
  return res.status(statusCode).json({
    success: false,
    error: errorPayload,
    meta: createMeta(requestId),
  });
}
