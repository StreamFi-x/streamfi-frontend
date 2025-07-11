import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  // Skipping CSRF check for GET requests
  if (req.method === "GET") {
    return NextResponse.next();
  }

  // Check CSRF token for POST requests, this is to give access to post request and prevent attacker
  const csrfToken = req.headers.get("x-csrf-token");
  const expectedToken = process.env.CSRF_SECRET;

  if (!csrfToken || csrfToken !== expectedToken) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/newsletter/:path*",
};
