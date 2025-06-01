import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected routes that require authentication
const PROTECTED_ROUTES = ["/settings", "/dashboard"];

// Session timeout in milliseconds (24 hours)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    // Get session cookies
    const wallet = request.cookies.get("wallet")?.value;
    const walletTimestamp = request.cookies.get("wallet_timestamp")?.value;

    // Check if session is valid
    const isSessionValid = wallet && walletTimestamp && 
      (Date.now() - parseInt(walletTimestamp)) < SESSION_TIMEOUT;

    if (!isSessionValid) {
      // Clear invalid session cookies
      const response = NextResponse.redirect(new URL("/explore", request.url));
      response.cookies.delete("wallet");
      response.cookies.delete("wallet_timestamp");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/settings/:path*",
    "/dashboard/:path*",
  ],
}; 