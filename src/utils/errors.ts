import { ERROR_CODES, ErrorCode } from '../config/constants';
import { ErrorDetail, SuggestedTime } from '../types/api';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly details?: ErrorDetail[];
  public readonly suggested_times?: SuggestedTime[];
  public readonly override_allowed?: boolean;

  constructor(
    statusCode: number,
    code: ErrorCode | string,
    message: string,
    options?: {
      details?: ErrorDetail[];
      suggested_times?: SuggestedTime[];
      override_allowed?: boolean;
    }
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = options?.details;
    this.suggested_times = options?.suggested_times;
    this.override_allowed = options?.override_allowed;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: ErrorDetail[]) {
    super(400, ERROR_CODES.VALIDATION_ERROR, message, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Chưa đăng nhập hoặc token không hợp lệ') {
    super(401, ERROR_CODES.UNAUTHORIZED, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện thao tác này') {
    super(403, ERROR_CODES.FORBIDDEN, message);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = 'Không tìm thấy tài nguyên yêu cầu',
    code: ErrorCode | string = ERROR_CODES.NOT_FOUND
  ) {
    super(404, code, message);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    code: ErrorCode | string = ERROR_CODES.SCHEDULE_CONFLICT,
    options?: {
      details?: ErrorDetail[];
      suggested_times?: SuggestedTime[];
      override_allowed?: boolean;
    }
  ) {
    super(409, code, message, options);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Tệp tải lên vượt quá dung lượng cho phép (tối đa 10 MB)') {
    super(413, ERROR_CODES.PAYLOAD_TOO_LARGE, message);
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, XLSX, PPTX') {
    super(415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, message);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message = 'Token đã hết hạn hoặc không còn hiệu lực') {
    super(410, ERROR_CODES.TOKEN_EXPIRED, message);
  }
}
