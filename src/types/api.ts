import { ErrorCode, WarningCode } from '../config/constants';

export interface Meta {
  timestamp: string;
  requestId: string;
  warnings?: Warning[];
}

export interface Warning {
  code: WarningCode | string;
  message: string;
}

export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: Meta;
}

export interface ErrorDetail {
  field?: string;
  code?: string;
  message?: string;
  entity_id?: number;
  entity_name?: string;
  meeting_id?: number;
  [key: string]: unknown;
}

export interface SuggestedTime {
  start_time: string;
  end_time: string;
}

export interface ErrorPayload {
  code: ErrorCode | string;
  message: string;
  details?: ErrorDetail[];
  suggested_times?: SuggestedTime[];
  override_allowed?: boolean;
}

export interface ErrorResponse {
  success: false;
  error: ErrorPayload;
  meta: Meta;
}
