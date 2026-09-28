import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors';
import { ErrorDetail } from '../types/api';

interface RequestValidationSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schema: RequestValidationSchema) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: ErrorDetail[] = error.errors.map((err) => ({
          field: err.path.join('.') || 'body',
          code: err.code,
          message: err.message,
        }));

        const primaryMessage = details[0]?.message || 'Dữ liệu không hợp lệ';
        return next(new ValidationError(primaryMessage, details));
      }
      next(error);
    }
  };
}
