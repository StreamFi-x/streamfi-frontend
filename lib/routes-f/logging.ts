import { createHash, randomUUID } from "crypto";

export type RoutesFLogContext = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

const REQUEST_ID_HEADER = "x-request-id";

export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);
  return existing && existing.trim().length > 0 ? existing : randomUUID();
}

export function cloneRequestWithId(req: Request, requestId: string): Request {
  const headers = new Headers(req.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  return new Request(req, { headers });
}

export function addRequestIdHeader(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function shouldLogRoutesF(): boolean {
  return process.env.ROUTES_F_LOGGING_DISABLED !== "true";
}

export function logRoutesFRequest(ctx: RoutesFLogContext) {
  if (!shouldLogRoutesF()) {
    return;
  }

  console.log("[routes-f]", {
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
    durationMs: ctx.durationMs,
  });
}

export function hashPayload(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

export const ROUTES_F_REQUEST_ID_HEADER = REQUEST_ID_HEADER;

export async function withRoutesFLogging(
  req: Request,
  handler: (request: Request) => Promise<Response>
): Promise<Response> {
  const requestId = getOrCreateRequestId(req.headers);
  const requestWithId = cloneRequestWithId(req, requestId);
  const start = Date.now();
  const url = new URL(req.url);

  const response = await handler(requestWithId);
  const durationMs = Date.now() - start;

  logRoutesFRequest({
    requestId,
    method: req.method,
    path: url.pathname,
    status: response.status,
    durationMs,
  });

  return addRequestIdHeader(response, requestId);
}
