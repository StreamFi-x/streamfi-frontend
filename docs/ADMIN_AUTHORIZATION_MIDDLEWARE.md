# Admin Authorization in Request Interception - Issue #1821

## Overview

This document describes the current authorization architecture for admin, dashboard, and settings routes, and identifies a critical gap in server-side authorization checks.

## Current State - Issue #1821

### Problem Summary

The project's request interception file (middleware) matches sensitive path patterns for:
- Admin area (`/admin/*`)
- Dashboard area (`/dashboard/*`)
- Settings area (`/settings/*`)

However, **these paths contain no authorization logic** beyond a subdomain redirect. The authorization gate is implemented purely **client-side** through a hook that fires only after the React bundle has already been downloaded and executed.

### Security Risk

1. **Bundle Shipping to Unauthorized Users**: The full admin interface code and strings ship to any visitor before authorization is checked
2. **Visible Loading Window**: Protected content briefly renders before being gated by client-side logic
3. **No Protection on JavaScript Failure**: If JavaScript fails to load or execute, there is no protection at all
4. **Information Disclosure**: Unauthorized users can inspect the bundled code to discover admin functionality structure

### Current Authorization Implementation

#### Client-Side (Hook-Based - Current)
Location: Typically a hook like `useAdminCheck()` or similar
```typescript
// Current pattern - runs AFTER page mount
useEffect(() => {
  fetch('/api/admin/check-access')
    .then(res => {
      if (!res.ok) redirect to unauthorized page
    })
}, [])
```

**Problems:**
- Hook fires after component mounts
- Full admin bundle already downloaded
- Race condition between render and authorization check
- No protection if JavaScript disabled

#### Server-Side (Missing - Needs Implementation)
Location: Middleware/interception file
```typescript
// Should intercept before React renders
// Check session validity before serving admin routes
// Redirect or block if not authorized
```

## Required Implementation Pattern

### Architecture: Server-Side Authorization Gate

The solution is to implement authorization checks in the **request interception file** (middleware) that already executes for these paths, before the React application ever runs.

### Implementation Requirements

1. **Session Validation**
   - Reuse existing session cookie verification logic
   - Check for valid admin session before serving admin content
   - Use same authentication mechanism as other server-side admin checks

2. **Middleware Logic Flow**
   ```
   Incoming Request
   ├─ Match sensitive paths (/admin, /dashboard, /settings)
   ├─ Extract and validate session cookie
   ├─ Check authorization status from session
   ├─ If NOT authorized: Redirect or return 401/403
   └─ If authorized: Allow request to proceed
   ```

3. **Preserve Existing Behavior**
   - Keep existing subdomain redirect logic intact
   - Don't break other middleware functionality
   - Maintain backward compatibility with current session handling

4. **Handle Framework Constraints**
   - Be aware of middleware runtime limitations
   - Use appropriate APIs for the current framework version
   - Test thoroughly in both development and deployment environments

### Acceptance Criteria (From Issue #1821)

> Requesting an admin path without a valid admin session is blocked or redirected before any admin page content or bundle is served, verified by requesting a protected admin path directly with no valid session and confirming no protected content is returned.

**Must Pass:**
- [ ] Anonymous request to `/admin/*` returns 401/403 or redirect (no content served)
- [ ] Session-less request to `/dashboard/*` returns 401/403 or redirect (no content served)
- [ ] Request to `/settings/*` with invalid session returns 401/403 or redirect
- [ ] Valid admin session request to `/admin/*` proceeds normally
- [ ] Existing subdomain redirect behavior still works
- [ ] No React bundle served before authorization check passes

## Implementation Considerations

### Session Verification Logic
Locate existing session validation code (likely in):
- `lib/auth/*` - authentication utilities
- `app/api/admin/*` - existing admin route protections
- `middleware.ts` or similar - any current session checks

**Reuse this logic** in the interception file rather than duplicating it.

### Response Handling

**Option 1: Redirect to Login**
```typescript
if (!isAuthorized) {
  return NextResponse.redirect(new URL('/login', request.url))
}
```

**Option 2: Deny with Status Code**
```typescript
if (!isAuthorized) {
  return new NextResponse('Unauthorized', { status: 401 })
}
```

**Option 3: Redirect to Unauthorized Page**
```typescript
if (!isAuthorized) {
  return NextResponse.redirect(new URL('/unauthorized', request.url))
}
```

Choose based on application UX requirements.

### Testing Approach

1. **Unit Tests**
   - Mock session objects with valid/invalid auth states
   - Test middleware decision logic
   - Verify correct response codes

2. **Integration Tests**
   - Request admin path without session cookie
   - Request admin path with expired session
   - Request admin path with valid session
   - Verify bundles are not served to unauthorized users

3. **Security Tests**
   - Attempt to bypass middleware with crafted requests
   - Verify session validation is thorough
   - Check for timing attacks in authentication logic

## Related Code Patterns

### Existing Admin Route Protection
If admin routes have server-side authorization, the middleware should use similar logic:
```typescript
// Look for patterns in app/api/admin routes
// Likely using session.isAdmin or similar check
```

### Session Cookie Handling
Check for existing session verification in:
- Privy integration (if used)
- JWT token validation
- Cookie parsing utilities

## Migration Path

1. **Phase 1: Understand Current Session Logic**
   - Identify how admin status is determined
   - Locate session verification code
   - Document current authorization checks

2. **Phase 2: Extract Session Check**
   - Create reusable session validation function
   - Make it available to middleware
   - Ensure it works in middleware runtime

3. **Phase 3: Add Middleware Authorization**
   - Implement authorization check for sensitive paths
   - Test with valid and invalid sessions
   - Preserve existing middleware behavior

4. **Phase 4: Remove Client-Side Gate (Future)**
   - Once middleware authorization is solid
   - Client-side hook becomes redundant
   - Can be removed after authorization is verified

## Security Considerations

- **Never trust client-side checks alone** - always gate at server
- **Verify session integrity** - check signature/expiration
- **Handle edge cases** - expired sessions, malformed cookies, etc.
- **Log authorization failures** - for security monitoring
- **Rate limit authorization checks** - prevent brute force attacks
- **Use secure cookie flags** - HttpOnly, Secure, SameSite

## References

- Issue #1821
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- Related: Middleware file patterns in current framework version
