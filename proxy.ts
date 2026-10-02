import { NextRequest, NextResponse } from "next/server";
import { createTraceContext, withTraceContextAsync } from "@/lib/tracing/trace-context";
import { logger } from "@/lib/tracing/logger";

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://auth.privy.io https://cdn.mux.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com https://images.unsplash.com https://picsum.photos https://image.mux.com https://via.placeholder.com",
    "media-src 'self' blob: https://*.mux.com",
    "frame-src https://*.privy.io https://*.walletconnect.com",
    "connect-src 'self' https://*.privy.io wss://*.walletconnect.com https://*.walletconnect.com https://*.neon.tech https://*.mux.com https://*.litix.io https://horizon-testnet.stellar.org https://horizon.stellar.org",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/security/csp-report",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";

  // On the admin subdomain, redirect root to /admin so the user lands on
  // the admin panel without having to type /admin in the URL.
  if (hostname === "admin.streamfi.media" && req.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)",
    },
  ],
};
