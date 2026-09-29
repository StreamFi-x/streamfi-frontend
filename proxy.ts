import { NextRequest, NextResponse } from "next/server";
import { createTraceContext, withTraceContextAsync } from "@/lib/tracing/trace-context";
import { logger } from "@/lib/tracing/logger";

export async function proxy(req: NextRequest) {
  const hostname = req.headers.get("host") ?? "";

  // On the admin subdomain, redirect root to /admin so the user lands on
  // the admin panel without having to type /admin in the URL.
  if (hostname === "admin.streamfi.media" && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Extract incoming trace ID from request headers, or generate a new one
  const incomingTraceId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-trace-id") ||
    undefined;

  const traceContext = createTraceContext(incomingTraceId);

  // Run within trace context
  return withTraceContextAsync(traceContext, async () => {
    const pathname = req.nextUrl.pathname;

    logger.debug("Request started", {
      method: req.method,
      pathname,
      userAgent: req.headers.get("user-agent"),
    });

    // ── Newsletter API: CSRF validation ──
    if (pathname.startsWith("/api/newsletter/")) {
      if (req.method === "GET") {
        const response = NextResponse.next();
        response.headers.set("x-request-id", traceContext.traceId);
        return response;
      }

      const csrfToken = req.headers.get("x-csrf-token");
      const expectedToken = process.env.CSRF_SECRET;

      if (!csrfToken || csrfToken !== expectedToken) {
        logger.warn("CSRF validation failed", {
          hasToken: !!csrfToken,
        });
        return new Response(JSON.stringify({ error: "Invalid CSRF token" }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": traceContext.traceId,
          },
        });
      }
    }

    const response = NextResponse.next();
    // Propagate trace ID in response headers for client correlation
    response.headers.set("x-request-id", traceContext.traceId);
    return response;
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
