import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const PROTECTED_ROUTES = ['/settings', '/dashboard'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the route is protected
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  
  if (isProtectedRoute) {
    // Check for wallet in cookies or localStorage
    const wallet = request.cookies.get('wallet')?.value;
    
    if (!wallet) {
      // Redirect to explore if not authenticated
      return NextResponse.redirect(new URL('/explore', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/settings/:path*', '/dashboard/:path*'],
}; 