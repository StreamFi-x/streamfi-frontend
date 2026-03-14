import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";

  // On the admin subdomain, redirect root to /admin so the user lands on
  // the admin panel without having to type /admin in the URL.
  if (hostname === "admin.streamfi.media" && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/settings/:path*", "/dashboard/:path*", "/admin/:path*"],
};
