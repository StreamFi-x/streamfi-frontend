/**
 * API Security Middleware (#1387, #1386)
 *
 * Provides unified security middleware for API routes including:
 * - CSRF protection for mutating operations
 * - Consistent rate limiting with dual IP+user-id keying
 * - Security headers
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  extractCsrfTokenFromRequest, 
  validateCsrfToken, 
  isCsrfExemptRoute,
  type CsrfTokenPair 
} from "./csrf";
import { 
  checkRateLimits, 
  getClientIp, 
  RATE_LIMIT_POLICIES,
  type RateLimitPolicy 
} from "./rate-limit-policy";
import { tooManyRequests } from "@/lib/rate-limit";

export interface SecurityMiddlewareOptions {
  /** Enable CSRF protection for mutating methods */
  enableCsrf?: boolean;
  /** CSRF token hash to validate against (if CSRF enabled) */
  csrfTokenHash?: string;
  /** Rate limit policy to apply */
  rateLimitPolicy?: RateLimitPolicy;
  /** Rate limit namespace (defaults to route path) */
  rateLimitNamespace?: string;
  /** User ID for user-based rate limiting (if authenticated) */
  userId?: string;
}

export interface SecurityMiddlewareResult {
  /** If true, request should be allowed to proceed */
  allowed: boolean;
  /** Response if request should be blocked */
  response?: NextResponse;
  /** CSRF token pair to send to client (if newly generated) */
  csrfToken?: CsrfTokenPair;
}

/**
 * Apply security middleware to an API request
 * 
 * Usage in API routes:
 * ```ts
 * import { applySecurityMiddleware } from "@/lib/security/api-middleware";
 * import { createCsrfTokenPair } from "@/lib/security/csrf";
 * 
 * export async function POST(req: NextRequest) {
 *   const session = await verifySession(req);
 *   if (!session.ok) return session.response;
 * 
 *   const security = await applySecurityMiddleware(req, {
 *     enableCsrf: true,
 *     csrfTokenHash: session.csrfTokenHash, // from session storage
 *     rateLimitPolicy: RATE_LIMIT_POLICIES.tips.send,
 *     rateLimitNamespace: "tips-send",
 *     userId: session.userId,
 *   });
 * 
 *   if (!security.allowed) {
 *     return security.response;
 *   }
 * 
 *   // Proceed with request handler
 * }
 * ```
 */
export async function applySecurityMiddleware(
  req: NextRequest,
  options: SecurityMiddlewareOptions = {}
): Promise<SecurityMiddlewareResult> {
  const {
    enableCsrf = false,
    csrfTokenHash,
    rateLimitPolicy,
    rateLimitNamespace = req.nextUrl.pathname,
    userId,
  } = options;

  const method = req.method;
  const pathname = req.nextUrl.pathname;

  // 1. CSRF Protection for mutating methods
  if (enableCsrf && csrfTokenHash && isMutatingMethod(method)) {
    // Skip CSRF for exempt routes (webhooks, etc.)
    if (!isCsrfExemptRoute(pathname)) {
      const csrfToken = extractCsrfTokenFromRequest(req);
      
      if (!csrfToken) {
        return {
          allowed: false,
          response: NextResponse.json(
            { error: "CSRF token required" },
            { status: 403 }
          ),
        };
      }

      if (!validateCsrfToken(csrfToken, csrfTokenHash)) {
        return {
          allowed: false,
          response: NextResponse.json(
            { error: "Invalid CSRF token" },
            { status: 403 }
          ),
        };
      }
    }
  }

  // 2. Rate Limiting
  if (rateLimitPolicy) {
    const ip = getClientIp(req);
    const rateCheck = await checkRateLimits(
      rateLimitPolicy,
      rateLimitNamespace,
      ip,
      userId
    );

    if (!rateCheck.allowed) {
      // Return the more restrictive limit result
      const result = rateCheck.userResult && !rateCheck.userResult.success
        ? rateCheck.userResult
        : rateCheck.result;

      return {
        allowed: false,
        response: tooManyRequests(result, rateLimitPolicy.description),
      };
    }
  }

  // 3. Security Headers
  const response = NextResponse.next();
  addSecurityHeaders(response);

  return { allowed: true };
}

/**
 * Check if HTTP method is state-changing (requires CSRF protection)
 */
function isMutatingMethod(method: string): boolean {
  return ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase());
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  
  // Enable XSS protection
  response.headers.set("X-XSS-Protection", "1; mode=block");
  
  // Strict transport security (HTTPS only)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  
  // Content security policy (basic)
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
}

/**
 * CSRF protection wrapper for API routes
 * Simplified version for routes that don't need full middleware
 */
export function withCsrfProtection(
  handler: (req: NextRequest) => Promise<NextResponse>,
  getCsrfHash: (req: NextRequest) => string | null | Promise<string | null>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const method = req.method;
    const pathname = req.nextUrl.pathname;

    // Only apply to mutating methods
    if (!isMutatingMethod(method) || isCsrfExemptRoute(pathname)) {
      return handler(req);
    }

    const csrfHash = await getCsrfHash(req);
    if (!csrfHash) {
      return NextResponse.json(
        { error: "CSRF protection not configured" },
        { status: 500 }
      );
    }

    const csrfToken = extractCsrfTokenFromRequest(req);
    if (!csrfToken || !validateCsrfToken(csrfToken, csrfHash)) {
      return NextResponse.json(
        { error: "Invalid CSRF token" },
        { status: 403 }
      );
    }

    return handler(req);
  };
}