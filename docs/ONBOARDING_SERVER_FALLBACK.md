# Onboarding Server-Side Fallback - Issue #1828

## Overview

This document describes the onboarding flow's critical reliance on client-side session storage and the missing server-side fallback for validation.

## Current State - Issue #1828

### Problem Summary

The onboarding page relies entirely on browser session storage with no server-side fallback:

1. **No Server Verification** - Never checks server for actual user state
2. **Silent Failures** - Malformed storage data fails silently with no explanation
3. **No Corruption Recovery** - If storage is empty or corrupted, user sees empty form
4. **Lost Sessions** - Returning users lose onboarding status when storage is cleared
5. **Vulnerable to Storage Issues** - Storage quota problems, stale data, version mismatches

### Current Implementation Pattern

```typescript
// Current pattern - client-side only
function OnboardingPage() {
  const [email, setEmail] = useState('');
  
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('onboarding_session');
      const parsed = JSON.parse(stored || '{}');
      
      setEmail(parsed.email || '');
      
      // If user already has username, redirect
      if (parsed.username) {
        redirect('/dashboard');
      }
    } catch (error) {
      // Silent fail - no error message shown to user
      // User sees empty form with no explanation
    }
  }, []);
  
  return (
    <form>
      <input value={email} onChange={e => setEmail(e.target.value)} />
      {/* ... rest of form ... */}
    </form>
  );
}
```

### Risks & Failure Scenarios

#### Scenario 1: Corrupted Storage Data
- User has completed onboarding in previous session
- Storage key has corrupted value (quota issue, version mismatch, etc.)
- JSON.parse() throws error
- Error silently caught, user sees empty form
- No indication what went wrong
- User has to re-onboard or debug browser storage manually

#### Scenario 2: Storage Cleared Between Sessions
- User completes onboarding, logs out
- Closes browser (session storage cleared)
- Reopens browser, re-authenticates
- Session storage is now empty
- Onboarding page shows again
- User forced to re-onboard even though they already completed it
- Server has their profile and username but client doesn't know

#### Scenario 3: Storage Quota Exceeded
- User has many tabs open
- Browser storage quota hit
- sessionStorage operations fail silently
- Onboarding state not stored
- User can't proceed through onboarding
- No error message shown
- User confused about what went wrong

#### Scenario 4: Mobile Browser Memory Pressure
- Mobile browser kills app in background (memory pressure)
- Session storage cleared
- User re-opens app
- Forced to re-onboard
- Server knows user already onboarded, client doesn't

#### Scenario 5: Version Mismatch
- App deployed with new onboarding flow
- Old session storage format incompatible
- Parsing fails
- Silent error, user sees empty form

### What Storage Provides (Limited)

```typescript
// What sessionStorage stores:
{
  email: "user@example.com",
  username: "myusername",
  // ... other onboarding state
}
```

**Problem:** This data is LOCAL ONLY
- Not synced with server
- Can be cleared by user or browser
- No guarantee it matches server state
- Can't be trusted as source of truth

## Acceptance Criteria - Issue #1828

From the issue:
> A returning authenticated user who already completed onboarding in a previous session, but whose local session storage has since been cleared, is correctly recognized as already onboarded and is not shown the onboarding flow again.

**Must Pass:**
- [ ] Authenticated user with cleared session storage not shown onboarding
- [ ] Server-side onboarding status checked before showing form
- [ ] Existing username retrieved from server
- [ ] User redirected to dashboard if already onboarded
- [ ] Error messages shown for actual failures (not silent)
- [ ] Corrupted storage doesn't break flow (fallback to server)

## Required Implementation

### Architecture: Client-Side + Server-Side

```
Initial Page Load
├─ Check if user is authenticated
├─ Check local sessionStorage
│  ├─ If valid: Show form (prefilled)
│  └─ If empty/corrupted: Query server
└─ Query Server API: /api/user/onboarding-status
   ├─ If already onboarded: Redirect to /dashboard
   ├─ If not onboarded: Show form (empty or prefilled from server)
   └─ If error: Show error message
```

### New Server Endpoint Needed

```typescript
// GET /api/user/onboarding-status
// Headers: Authorization: Bearer {token}
// Response (if already onboarded):
{
  onboarded: true,
  username: "myusername",
  email: "user@example.com",
  redirect: "/dashboard"
}

// Response (if not yet onboarded):
{
  onboarded: false,
  username: null,
  email: "user@example.com", // From profile
  redirect: null
}

// Response (if error):
{
  error: "Failed to retrieve onboarding status",
  status: 500
}
```

### Client-Side Implementation Pattern

```typescript
function OnboardingPage() {
  const [state, setState] = useState<'loading' | 'form' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    initializeOnboarding();
  }, []);
  
  const initializeOnboarding = async () => {
    try {
      // Step 1: Try local storage (faster)
      const localData = getLocalOnboardingData();
      
      if (localData && isValid(localData)) {
        setEmail(localData.email);
        setState('form');
        return;
      }
      
      // Step 2: Local storage invalid/empty, query server
      const response = await fetch('/api/user/onboarding-status', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to check onboarding status');
      }
      
      const data = await response.json();
      
      if (data.onboarded) {
        // Already onboarded, redirect
        router.push(data.redirect || '/dashboard');
        return;
      }
      
      // Not yet onboarded, show form
      setEmail(data.email || '');
      setState('form');
      
    } catch (err) {
      // Show error to user
      setError(err instanceof Error ? err.message : 'Unknown error');
      setState('error');
    }
  };
  
  // ... render form or error state
}
```

### Handling Storage Corruption

```typescript
function getLocalOnboardingData() {
  try {
    const stored = sessionStorage.getItem('onboarding_session');
    if (!stored) return null;
    
    const data = JSON.parse(stored);
    
    // Validate structure
    if (!data.email || typeof data.email !== 'string') {
      throw new Error('Invalid email format');
    }
    
    return data;
  } catch (error) {
    // Storage corrupted, return null to trigger server fallback
    console.warn('Corrupted onboarding storage, using server fallback');
    return null;
  }
}
```

### Error Handling & User Feedback

```typescript
function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  
  // ... initialization
  
  if (error) {
    return (
      <div className="error-container">
        <h2>Onboarding Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Try Again
        </button>
        <p className="help-text">
          If this persists, please contact support.
        </p>
      </div>
    );
  }
  
  // ... form rendering
}
```

## Storage Strategy Recommendation

### Local Storage (Session)
```typescript
// Use for optimization - quick access if available
// But NEVER trust as source of truth
sessionStorage.setItem('onboarding_session', JSON.stringify({
  email: user.email,
  username: user.username,
  timestamp: Date.now(), // Validate freshness
  version: 2 // Handle version mismatches
}));
```

### Server as Source of Truth
- Query server for actual user state
- Server knows if user has completed onboarding
- Server knows user's current username
- Server has authoritative profile data

### Fallback Flow
1. Client storage (if valid) → Use immediately (UX optimization)
2. Server check → Use server data (source of truth)
3. If both fail → Show error with clear message

## Mobile Considerations

- Session storage may be cleared more aggressively on mobile
- Memory pressure can clear storage unexpectedly
- Users may close and reopen app frequently
- Server-side verification is MORE important for mobile

## Testing Requirements

### Unit Tests
- [ ] Storage corruption handled gracefully
- [ ] Empty storage triggers server check
- [ ] Valid storage used without server call
- [ ] Invalid data format rejected

### Integration Tests
- [ ] Fresh authenticate user + cleared storage → Form shown
- [ ] Already onboarded user + cleared storage → Redirected
- [ ] Storage mismatch with server → Server state takes precedence
- [ ] Server error → Fallback to local (or show error)

### Manual Testing
1. Complete onboarding
2. Open DevTools → Application → Session Storage
3. Delete onboarding_session key
4. Refresh page
5. Verify: User redirected to dashboard (not shown onboarding form)

## Security Considerations

- **Do NOT use sessionStorage for auth tokens** - Always use httpOnly cookies
- **Validate server response** - Never trust client-only data for access control
- **Check user identity** - Server should verify user before returning onboarding status
- **Rate limit** - Prevent abuse of onboarding endpoint

## Compatibility Matrix

| Scenario | Current | After Fix |
|----------|---------|-----------|
| Fresh user, empty storage | ✓ Shows form | ✓ Shows form |
| Returning user, storage intact | ✓ Works | ✓ Works (optimized) |
| Returning user, storage cleared | ✗ Shows form (forces re-onboard) | ✓ Redirected (uses server) |
| Corrupted storage | ✗ Silent fail | ✓ Falls back to server |
| Storage quota exceeded | ✗ Silent fail | ✓ Server provides data |
| Mobile app memory killed | ✗ Forces re-onboard | ✓ Uses server state |

## Migration Path

### Phase 1: Add Server Endpoint
- Implement `/api/user/onboarding-status` endpoint
- Test with curl/Postman
- Document response format

### Phase 2: Client-Side Update
- Add server check as fallback
- Handle corruption gracefully
- Show error messages for real failures

### Phase 3: Testing
- Test all failure scenarios
- Mobile testing (storage clearing)
- User feedback testing

### Phase 4: Deploy & Monitor
- Deploy to production
- Monitor error logs
- Verify users with cleared storage flow correctly

## Related Issues

- Issue #1828 - Main issue for onboarding server fallback

## References

- [MDN: sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- [MDN: Client Storage Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)
- [Building Resilient Web Applications](https://web.dev/resilient-web-apps/)
