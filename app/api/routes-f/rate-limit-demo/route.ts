import { NextResponse } from "next/server";
import { consumeToken, getRequestIp } from "./_lib/token-bucket";

function buildHeaders(result: ReturnType<typeof consumeToken>) {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.reset_epoch_seconds));
  return headers;
}

export function GET(request: Request) {
  const ip = getRequestIp(request);
  const result = consumeToken(ip);
  const headers = buildHeaders(result);

  if (!result.allowed) {
    headers.set("Retry-After", String(result.retry_after_seconds));
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded.",
        retry_after_seconds: result.retry_after_seconds,
      },
      {
        status: 429,
        headers,
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Request accepted.",
      remaining: result.remaining,
    },
    {
      status: 200,
      headers,
    }
  );
}
