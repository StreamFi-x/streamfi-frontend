/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ApiResponse, ErrorCode } from '../types/api';

export class ApiResponseBuilder {
  static success<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
    };
  }

  static error(code: ErrorCode, message: string): ApiResponse<never> {
    return {
      success: false,
      error: { code, message },
    };
  }

  static validationError(errors: Array<{ field: string; message: string }>): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    };
  }
}

export function createErrorResponse(code: ErrorCode, message: string): Response {
  return Response.json(ApiResponseBuilder.error(code, message), { status: 400 });
}

export function createValidationErrorResponse(errors: Array<{ field: string; message: string }>): Response {
  return Response.json(ApiResponseBuilder.validationError(errors), { status: 400 });
}

export function createSuccessResponse<T>(data: T): Response {
  return Response.json(ApiResponseBuilder.success(data));
}