# ESLint exhaustive-deps Audit and Enforcement - Issue #1693

## Overview

This document describes the audit needed to ensure ESLint's `exhaustive-deps` rule is properly enabled and enforced across all useEffect hooks in the codebase.

## Current State - Issue #1693

### Problem Summary

A repository-wide check found potential gaps in `exhaustive-deps` rule enforcement:

1. **Uncertain Configuration** - Rule may not be enabled at error level
2. **42+ Files Without Explicit Exemption** - Either all pass, or silently violating
3. **Risk of Stale Closures** - Missing dependencies can cause silent bugs
4. **High-Risk Locations** - Especially in contexts and hooks managing state
5. **Timing-Dependent Bugs** - Issues only appear in specific scenarios

### Why This Matters

**Stale Closure Bug Example:**

```typescript
// Missing dependency: 'userId'
function UserProfile({ userId }: { userId: string }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    // This closure captures initial userId only
    fetch(`/api/users/${userId}`).then(data => {
      setProfile(data);
    });
  }, []); // BUG: Missing userId dependency

  // If userId changes, effect doesn't re-run
  // Component shows stale data from previous user
  return <div>{profile?.name}</div>;
}
```

**Silent Symptoms:**
- Component shows wrong data
- No error in console
- Only manifests when user changes
- Hard to debug and reproduce

## Affected Areas

**High-Risk Locations Mentioned:**
- `contexts/stellar-wallet-context.tsx` - Wallet state management
- `hooks/useStreamData.ts` - Stream data subscription
- Other context files managing critical state

## Acceptance Criteria - Issue #1693

From the issue:
> The exhaustive-deps rule is confirmed enabled at error level, every resulting violation across the codebase has been reviewed and either fixed or explicitly and individually justified with a comment explaining why the dependency is intentionally omitted.

**Must Pass:**
- [ ] ESLint config has `react-hooks/exhaustive-deps: "error"`
- [ ] All 42+ files manually reviewed
- [ ] Each violation either fixed or justified
- [ ] Justification comments explain intentional omission
- [ ] No blanket `eslint-disable` comments
- [ ] CI enforces rule (test fails if violation added)
- [ ] Team trained on dependency handling

## Required Implementation

### Step 1: Enable Rule at Error Level

**File: `.eslintrc.json` (verify/update)**

```json
{
  "extends": ["plugin:react-hooks/recommended"],
  "rules": {
    "react-hooks/exhaustive-deps": "error"
  }
}
```

Or if using newer ESLint config:

**File: `eslint.config.mjs` (if using flat config)**

```javascript
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "error", // Must be "error", not "warn"
    },
  },
];
```

### Step 2: Run ESLint to Find Violations

```bash
# Find all exhaustive-deps violations
npx eslint . --rule "react-hooks/exhaustive-deps: error" 2>&1 | grep -A 2 "exhaustive-deps"

# Or run and see all violations
npm run lint
```

### Step 3: Categorize Violations

**Categories for each violation:**

1. **Bug - Fix It**
   - Missing actual dependencies
   - Causes stale closure or incorrect behavior
   - Fix by adding to dependency array

2. **Intentional - Justify It**
   - Effect should only run once
   - Function intentionally captures initial value
   - Must add comment explaining why

3. **False Positive - Suppress It**
   - Dependency incorrectly flagged by ESLint
   - Rare, but sometimes happens with derived values
   - Suppress with specific comment

### Step 4: Fix or Justify Each Violation

#### Example 1: Bug That Needs Fixing

**Before (WRONG):**
```typescript
// contexts/stellar-wallet-context.tsx
const connect = async (wallet: string) => {
  const [userSession, setUserSession] = useState(null);

  useEffect(() => {
    // BUG: Missing 'wallet' dependency
    fetchWalletData(wallet).then(data => {
      setUserSession(data);
    });
  }, []); // Violation: missing 'wallet'
};
```

**After (FIXED):**
```typescript
useEffect(() => {
  fetchWalletData(wallet).then(data => {
    setUserSession(data);
  });
}, [wallet]); // FIXED: Added missing dependency
```

#### Example 2: Intentional Omission That Needs Justification

**Before (No Context):**
```typescript
useEffect(() => {
  const timer = setInterval(() => {
    // Intentionally uses stale callback
    handleTick();
  }, 1000);
  return () => clearInterval(timer);
}, []); // Violation: missing handleTick
```

**After (With Justification):**
```typescript
// INTENTIONAL: Effect runs once and sets up interval for lifetime of component.
// handleTick is captured at effect creation time (initial render). If component
// needs to handle dynamic function changes, use a ref or restructure component.
// See: https://github.com/facebook/react/issues/14078
useEffect(() => {
  const timer = setInterval(() => {
    handleTick();
  }, 1000);
  return () => clearInterval(timer);
}, []);
```

#### Example 3: Fixing with useCallback

**Before (Complex Dependencies):**
```typescript
// hooks/useStreamData.ts
function useStreamData(streamId: string, shouldFetch: boolean) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!shouldFetch) return;
    
    fetch(`/api/streams/${streamId}`).then(res => {
      setData(res);
    });
  }, [streamId, shouldFetch]); // Simple case
}
```

**After (Better with useCallback for complex logic):**
```typescript
const fetchStreamData = useCallback(async () => {
  if (!shouldFetch) return;
  
  const res = await fetch(`/api/streams/${streamId}`);
  setData(res);
}, [streamId, shouldFetch]); // Dependencies for callback

useEffect(() => {
  fetchStreamData();
}, [fetchStreamData]); // Only callback as dependency
```

### Step 5: Add Comment Headers

**For every violation review, add comment:**

```typescript
// Issue #1693: Audited exhaustive-deps violation
// Status: [FIXED | INTENTIONAL | FALSE_POSITIVE]
// Reason: [Brief explanation]
useEffect(() => {
  // ...
}, [dependencies]);
```

### Step 6: Document Patterns

**Create file: `docs/REACT_HOOKS_PATTERNS.md`**

```markdown
# React Hooks Best Practices

## useEffect Dependencies

### Pattern 1: Simple Dependencies
```typescript
const [data, setData] = useState(null);
const [filter, setFilter] = useState("");

useEffect(() => {
  fetchData(filter).then(setData);
}, [filter]); // Include all used values
```

### Pattern 2: Setup/Cleanup Once
```typescript
// INTENTIONAL: Subscribe only on mount
useEffect(() => {
  const subscription = dataSource.subscribe(setData);
  return () => subscription.unsubscribe();
}, []); // Intentionally empty - runs once
```

### Pattern 3: Dynamic Function
```typescript
const handleUpdate = useCallback(() => {
  updateData(value);
}, [value]); // Callback dependencies

useEffect(() => {
  handleUpdate();
}, [handleUpdate]); // Use callback as dependency
```

### Pattern 4: Reference Equality
```typescript
// Object literals cause dependency issues
const options = { timeout: 5000 }; // Creates new object on each render
useEffect(() => {
  fetch(url, options).then(setData);
}, [options]); // Re-runs every render!

// Solution: useMemo
const options = useMemo(() => ({ timeout: 5000 }), []);
useEffect(() => {
  fetch(url, options).then(setData);
}, [options]); // Stable reference
```
```

## Audit Process

### Step 1: Get Baseline

```bash
# Run ESLint and capture violations
npx eslint . --format=json > baseline.json

# Count violations
cat baseline.json | jq '[.[] | .messages[] | select(.ruleId == "react-hooks/exhaustive-deps")] | length'
```

### Step 2: Triage Each File

```bash
# For each file with violation:
# 1. Open file
# 2. Look at useEffect
# 3. Determine if bug or intentional
# 4. Fix or add justification comment
# 5. Re-run ESLint
# 6. Verify fixed
```

### Step 3: Verify Fix

```bash
# Run ESLint again - should have 0 violations
npx eslint . --rule "react-hooks/exhaustive-deps: error"

# Should output: 0 errors
```

### Step 4: Set Up CI Check

**Add to CI/CD pipeline:**

```yaml
# .github/workflows/lint.yml
- name: Check exhaustive-deps
  run: npx eslint . --rule "react-hooks/exhaustive-deps: error"
```

## Common Issues and Fixes

### Issue: Object/Array in Dependencies

```typescript
// WRONG: config object causes re-run every render
const config = { url, timeout: 5000 };
useEffect(() => {
  fetch(url, config).then(setData);
}, [config]); // Re-runs every render

// RIGHT: Memoize the object
const config = useMemo(() => ({ url, timeout: 5000 }), [url]);
useEffect(() => {
  fetch(url, config).then(setData);
}, [config]); // Only re-runs when config changes
```

### Issue: Function Props

```typescript
// WRONG: Props function creates closure issue
function Component({ onData }: { onData: (data: any) => void }) {
  useEffect(() => {
    fetchData().then(onData);
  }, []); // Missing onData dependency!
}

// RIGHT: Include function or wrap it
useEffect(() => {
  fetchData().then(onData);
}, [onData]); // Function as dependency
```

### Issue: Context Values

```typescript
// WRONG: Using context value without dependency
const user = useContext(UserContext);
useEffect(() => {
  setGreeting(`Hello ${user.name}`);
}, []); // Missing user dependency

// RIGHT: Include context value
useEffect(() => {
  setGreeting(`Hello ${user.name}`);
}, [user]); // Include context value

// OR if only using specific field:
useEffect(() => {
  setGreeting(`Hello ${user.name}`);
}, [user.name]); // More specific dependency
```

## Testing the Fix

### Unit Tests

```typescript
describe("useEffect exhaustive-deps", () => {
  it("should update when dependencies change", () => {
    const { rerender } = render(
      <Component streamId="123" />
    );
    expect(fetchSpy).toHaveBeenCalledWith("123");

    rerender(<Component streamId="456" />);
    expect(fetchSpy).toHaveBeenCalledWith("456");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
```

### Integration Tests

```typescript
test("wallet switching updates all dependent state", async () => {
  const { getByText } = render(<App />);
  
  // Click to switch wallets
  fireEvent.click(getByText("Switch Wallet"));
  
  // Should update context and all consumers
  await waitFor(() => {
    expect(getByText("New Wallet")).toBeInTheDocument();
  });
});
```

## Documentation Requirement

**For every violation with justification comment, document:**

1. **Why dependency is intentional missing**
2. **What would happen if it were included**
3. **Reference to design decision or issue**
4. **How to change it if behavior needs to evolve**

## Related High-Risk Files

**Files mentioned in issue to prioritize:**

1. **`contexts/stellar-wallet-context.tsx`**
   - Critical: Manages wallet state
   - Risk: Stale closures could corrupt wallet connection
   - Priority: HIGH

2. **`hooks/useStreamData.ts`**
   - Critical: Manages stream data subscriptions
   - Risk: Stale closures could show wrong stream data
   - Priority: HIGH

3. **Other context files**
   - Review all context providers
   - Ensure subscriptions re-run when dependencies change

## Success Criteria

✅ ESLint config enables rule at error level  
✅ All violations manually reviewed (42+ files)  
✅ Each reviewed violation documented  
✅ Fixes applied for bugs  
✅ Justifications added for intentional omissions  
✅ CI enforces rule (blocks new violations)  
✅ Team trained on patterns  
✅ No stale closure bugs in production  

## Long-term Maintenance

- **Weekly lint runs** - Catch violations before merge
- **Code review checklist** - Reviewer verifies dependencies
- **Test coverage** - Tests verify dependency changes trigger updates
- **Documentation** - Keep patterns doc updated with new learnings
- **Team training** - Onboard new devs on exhaustive-deps patterns

## Related Issues

- Issue #1693 - Main issue for exhaustive-deps audit
- Related: Any stale closure bugs in production

## References

- [ESLint react-hooks/exhaustive-deps](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md)
- [React useEffect Dependency Array](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies)
- [Stale Closure Blog Post](https://dmitripavlutin.com/react-hooks-closure/)

## Notes

- This is a systematic issue requiring team coordination
- No quick fix - requires careful review of each violation
- Once fixed, stays fixed with proper CI enforcement
- Invest in team education about dependency handling
- Future PRs will block if new violations introduced
