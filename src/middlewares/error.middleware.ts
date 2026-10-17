import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { ERROR_CODES } from '../config/constants';
import { sendError } from '../utils/response';
import { logger } from '../utils/logger';

export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.requestId || 'unknown';

  if (err instanceof AppError) {
    logger.warn(`AppError [${err.code}]: ${err.message}`, { details: err.details }, requestId);

    sendError(res, err.statusCode, {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
      ...(err.suggested_times ? { suggested_times: err.suggested_times } : {}),
      ...(typeof err.override_allowed === 'boolean' ? { override_allowed: err.override_allowed } : {}),
    });
    return;
  }

  // Handle malformed JSON body
  if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400) {
    logger.warn(`Malformed JSON body: ${err.message}`, undefined, requestId);
    sendError(res, 400, {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Dữ liệu JSON không đúng định dạng',
      details: [{ field: 'body', code: 'invalid_json', message: err.message }],
    });
    return;
  }

  // Internal Server Error
  logger.error(`Unhandled Error: ${err.message}`, { stack: err.stack }, requestId);

  sendError(res, 500, {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: 'Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
  });
}
