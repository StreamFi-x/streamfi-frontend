import { NextResponse } from "next/server";

export const ROUTES_F_ERROR_CODES = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type RoutesFErrorCode =
  (typeof ROUTES_F_ERROR_CODES)[keyof typeof ROUTES_F_ERROR_CODES];

export const ROUTES_F_STATUS_BY_CODE: Record<RoutesFErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_ERROR: 500,
};

export type RoutesFErrorBody = {
  code: RoutesFErrorCode;
  message: string;
  details: unknown;
};

export class RoutesFError extends Error {
  code: RoutesFErrorCode;
  details: unknown;

  constructor(code: RoutesFErrorCode, message: string, details: unknown = null) {
    super(message);
    this.name = "RoutesFError";
    this.code = code;
    this.details = details;
  }
}

export function normalizeRoutesFError(error: unknown): {
  status: number;
  body: RoutesFErrorBody;
} {
  if (error instanceof RoutesFError) {
    return {
      status: ROUTES_F_STATUS_BY_CODE[error.code],
      body: {
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      },
    };
  }

  return {
    status: ROUTES_F_STATUS_BY_CODE.INTERNAL_ERROR,
    body: {
      code: ROUTES_F_ERROR_CODES.INTERNAL_ERROR,
      message: "Internal server error",
      details: null,
    },
  };
}

export function routesFErrorResponse(error: unknown): Response {
  const normalized = normalizeRoutesFError(error);
  return NextResponse.json(normalized.body, { status: normalized.status });
}
