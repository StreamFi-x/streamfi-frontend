# Middleware Architecture and Dead Files

## Overview

This document describes the middleware architecture and identifies deprecated files that should not be used.

## Dead Middleware File: `_middleware.ts` - Issue #1820

### Problem

The file `_middleware.ts` at the project root uses an obsolete filename convention from an older version of the framework (Vercel's old Edge Functions naming pattern). This file **does not execute** in the current framework version.

**Current Status:** Dead code - provides no protection or functionality.

### Why It's Dangerous

1. **Silent Non-Execution**: The file compiles and appears syntactically correct, giving developers a false sense of security
2. **No Warnings**: The framework provides no indication that this file is inert
3. **Potential Vulnerabilities**: If this file contained security checks (like CSRF protection), those checks would silently not execute
4. **Future Risk**: If similar routes are added later, developers might assume this file protects them when it doesn't

### Historical Context

The file was originally named `_middleware.ts` following the Vercel Edge Functions convention from Next.js versions < 12.2.

### Current Framework Convention

Modern Next.js (12.2+) requires:
- **Filename**: `middleware.ts` or `middleware.js` (no underscore prefix)
- **Location**: Project root
- **Export**: Default export of middleware function
- **Type**: Must be a proper `NextMiddleware` function

### What Happened to This File

The current file at `_middleware.ts` contains only deprecation notice:

```typescript
// This file is deprecated. Use middleware.ts instead.
// middleware.ts now handles trace context propagation globally.
```

### Action Required

- ✅ The file has been marked as deprecated
- ✅ Actual middleware logic has been migrated to `middleware.ts`
- ⚠️ **Security Note**: If CSRF protection was removed from middleware, verify it's implemented elsewhere or add it to the active `middleware.ts`

### Verification Checklist

- [ ] Confirm `_middleware.ts` contains only deprecation notice
- [ ] Verify `middleware.ts` exists and handles all necessary interception logic
- [ ] If CSRF protection was in `_middleware.ts`, confirm it's implemented in active middleware or route handlers
- [ ] No new route should rely on dead middleware for security

## Active Middleware

See `middleware.ts` for the current, executing middleware implementation.

## References

- [Next.js Middleware Documentation](https://nextjs.org/docs/advanced-features/middleware)
- Related Issues: #1820
