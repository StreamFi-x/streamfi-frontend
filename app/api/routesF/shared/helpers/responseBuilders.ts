import { routesFSuccess, routesFError } from '../../response';
import { API_VERSION } from '../constants';
import type { ApiResponse } from '../types';

/**
 * Build success response with data
 */
export function buildSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    apiVersion: API_VERSION,
    success: true,
    data,
  };
}

/**
 * Build error response
 */
export function buildErrorResponse(message: string, extraData?: Record<string, unknown>): ApiResponse<never> {
  return {
    apiVersion: API_VERSION,
    success: false,
    error: message,
    ...extraData,
  };
}

/**
 * Create HTTP success response
 */
export function createSuccessResponse<T>(data: T, status = 200): Response {
  return routesFSuccess(data, status);
}

/**
 * Create HTTP error response
 */
export function createErrorResponse(message: string, status = 400, extraData?: Record<string, unknown>): Response {
  return routesFError(message, status, undefined, extraData);
}

/**
 * Create validation error response
 */
export function createValidationErrorResponse(errors: Array<{ field: string; message: string }>): Response {
  return createErrorResponse('Validation failed', 400, { errors });
}

/**
 * Create not found error response
 */
export function createNotFoundErrorResponse(resource: string): Response {
  return createErrorResponse(`${resource} not found`, 404);
}

/**
 * Create conflict error response
 */
export function createConflictErrorResponse(message: string): Response {
  return createErrorResponse(message, 409);
}

/**
 * Create unprocessable entity error response
 */
export function createUnprocessableEntityErrorResponse(message: string): Response {
  return createErrorResponse(message, 422);
}

/**
 * Create internal server error response
 */
export function createInternalServerErrorResponse(): Response {
  return createErrorResponse('Internal server error', 500);
}