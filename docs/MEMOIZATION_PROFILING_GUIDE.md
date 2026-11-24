# Memoization Profiling and Re-render Optimization - Issue #1692

## Overview

This document describes the current memoization gaps across dashboard, explore, and stream component trees, and the profiling methodology needed to identify and fix re-render storms during live chat activity.

## Current State - Issue #1692

### Problem Summary

Low memoization coverage across critical component trees creates potential re-render storms:

1. **Minimal Memoization Usage** - Only ~12 instances of useMemo/useCallback/React.memo combined
2. **Unprotected Hot Paths** - Chat.tsx, ActivityFeed.tsx, StreamPreview.tsx, view-stream.tsx re-render on every update
3. **No Memoization Boundaries** - Single chat message cascades re-renders across sidebar and navigation
4. **Undocumented Impact** - No profiler data showing actual render counts

### Affected Components

**High-Impact Components (need analysis):**
- `components/stream/Chat.tsx` - Receives message updates frequently
- `components/dashboard/stream-manager/ActivityFeed.tsx` - Updates on events
- `components/stream/view-stream.tsx` - Main stream viewer
- `components/dashboard/StreamPreview.tsx` - Stream preview tiles
- Navigation/Sidebar trees - Adjacent to chat, likely affected

**Related Trees:**
- `components/dashboard/*` - Dashboard tree
- `components/explore/*` - Explore/browse tree
- `components/stream/*` - Stream viewer tree

## Why Blanket Memoization Is Wrong

**Anti-Pattern: Sprinkling memo everywhere**
```typescript
// DON'T do this without profiling
const Button = React.memo(({ onClick }) => <button onClick={onClick} />);
const List = React.memo(({ items }) => <ul>{items}</ul>);
const Page = React.memo(({ data }) => <main>{data}</main>);
// ↑ Adds complexity without evidence of benefit
```

**Problems with this approach:**
- Memoization has overhead (comparison, shallow equality checks)
- Memoization prevents legitimate re-renders
- Without profiling, you're guessing where the hot paths are
- False security: "We memoized everything" ≠ "Performance is good"

## Required Profiling Process - Issue #1692

### Step 1: Establish Baseline

**Using React DevTools Profiler:**

1. Open Chrome DevTools → React tab → Profiler
2. Start recording
3. Trigger a chat message in live stream (using test data)
4. Stop recording
5. Analyze render counts:
   - Note which components rendered
   - How many times each component rendered
   - Render duration for each

**Baseline Metrics to Capture:**
```
Chat message triggers update:
- Chat.tsx: 1 render (expected)
- MessageList.tsx: 1 render (expected)
- Message.tsx: 1 render (expected)
- Sidebar.tsx: ? renders (should be 0, likely > 0)
- Navbar.tsx: ? renders (should be 0, likely > 0)
- Dashboard.tsx: ? renders (should be 0, likely > 0)
- StreamPreview.tsx: ? renders (should be 0, likely > 0)
```

### Step 2: Identify Hot Paths

**Questions to answer via profiling:**

1. **Does a single chat message re-render the entire sidebar?**
   - If yes, context issue or missing memo boundary
   
2. **Does the navbar re-render on chat activity?**
   - If yes, shared context or prop drilling problem

3. **Do unrelated stream preview tiles re-render?**
   - If yes, likely a context that's too broad

4. **What's the render count multiplier?**
   - Chat message causes: Chat (1x) + Sidebar (5x) + Navbar (3x) + Previews (8x) = 17 unnecessary renders?

### Step 3: Root Cause Analysis

**Common culprits in React apps:**

1. **Context Consumers Without Memoization**
   - Component consumes context, forces re-render on any context change
   - Fix: Wrap consumer children in memo, or split context

2. **Object/Array Props Created on Every Render**
   ```typescript
   // ❌ Creates new object every render
   <Component style={{ color: 'red' }} />
   
   // ✓ Memoized object
   const style = useMemo(() => ({ color: 'red' }), []);
   <Component style={style} />
   ```

3. **Callback Props Without useCallback**
   ```typescript
   // ❌ Creates new function every render
   <Component onClick={() => handleClick()} />
   
   // ✓ Memoized callback
   const handler = useCallback(() => handleClick(), []);
   <Component onClick={handler} />
   ```

4. **Missing React.memo on Components**
   ```typescript
   // ❌ Component always re-renders
   function ChatMessage({ text }) { return <div>{text}</div>; }
   
   // ✓ Memoized for prop comparison
   const ChatMessage = React.memo(({ text }) => <div>{text}</div>);
   ```

### Step 4: Document Findings

**Before/After Profiler Trace:**

```
BEFORE (Baseline):
Chat message arrives
├─ Chat.tsx: 1 render (67ms)
├─ MessageList.tsx: 1 render (45ms)
├─ Message.tsx: 1 render (12ms)
├─ Sidebar.tsx: 6 renders (234ms) ← PROBLEM
├─ Navbar.tsx: 4 renders (189ms) ← PROBLEM
├─ Dashboard.tsx: 2 renders (156ms) ← PROBLEM
├─ StreamPreview.tsx (×4): 4 renders (428ms) ← PROBLEM
└─ Total: ~18 renders in 1131ms

AFTER (After optimization):
Chat message arrives
├─ Chat.tsx: 1 render (67ms)
├─ MessageList.tsx: 1 render (45ms)
├─ Message.tsx: 1 render (12ms)
├─ Sidebar.tsx: 0 renders ✓ (memoized)
├─ Navbar.tsx: 0 renders ✓ (memoized)
├─ Dashboard.tsx: 0 renders ✓ (split context)
├─ StreamPreview.tsx (×4): 0 renders ✓ (memoized)
└─ Total: ~3 renders in 124ms (89% reduction!)
```

### Step 5: Implement Fixes

**Based on profiling findings, apply targeted fixes:**

#### Fix 1: Memoize Components
```typescript
// If ChatMessage renders unnecessarily:
const ChatMessage = React.memo(
  ({ text, author, timestamp }) => (
    <div>
      <strong>{author}</strong>: {text}
      <small>{timestamp}</small>
    </div>
  ),
  // Optional: custom comparison if default shallow check fails
  (prev, next) => {
    return prev.text === next.text && 
           prev.author === next.author &&
           prev.timestamp === next.timestamp;
  }
);
```

#### Fix 2: Split Context to Reduce Render Surface
```typescript
// If Chat context causes whole app to re-render:

// ❌ Single broad context
<ChatContext.Provider value={{ messages, users, settings }}>
  <App /> // Everything re-renders on any context change
</ChatContext.Provider>

// ✓ Split into narrower contexts
<MessageContext.Provider value={{ messages }}>
  <UserContext.Provider value={{ users }}>
    <SettingsContext.Provider value={{ settings }}>
      <App /> // Chat updates only affect message consumers
    </SettingsContext.Provider>
  </UserContext.Provider>
</MessageContext.Provider>
```

#### Fix 3: Memoize Props and Callbacks
```typescript
// If passing non-memoized props:

function StreamPreview({ stream, onSelect, theme }) {
  return (
    <Card onClick={onSelect} style={theme}>
      <Title>{stream.name}</Title>
    </Card>
  );
}

const MemoizedPreview = React.memo(StreamPreview);

// Usage:
const theme = useMemo(() => ({ bg: 'dark' }), []);
const handleSelect = useCallback((stream) => {
  router.push(`/watch/${stream.id}`);
}, [router]);

<MemoizedPreview stream={data} onSelect={handleSelect} theme={theme} />
```

#### Fix 4: Add useCallback to Event Handlers
```typescript
// If callbacks are created on every render:

const handleMessage = useCallback((message) => {
  addMessage(message);
  if (autoScroll) {
    scrollToBottom();
  }
}, [autoScroll]); // Only recreated if autoScroll changes

<ChatInput onSend={handleMessage} />
```

## Profiling Tools and Process

### React DevTools Profiler (Built-in)
1. Install React DevTools browser extension
2. Open DevTools → React tab
3. Click "Profiler" tab
4. Press circle to start recording
5. Interact with app (send chat message)
6. Press circle to stop
7. Analyze flamegraph and render counts

**What to look for:**
- Tall bars (slow renders) - optimization candidates
- Repeated render stacks - likely unnecessary re-renders
- Component names with high render counts - needs memoization

### Chrome DevTools Performance Tab
1. DevTools → Performance tab
2. Record execution while triggering chat message
3. Look for Long Tasks and expensive rendering
4. Correlate with React profiler data

### Key Metrics to Track
- **Render count per component** - Should be minimal for unrelated components
- **Render duration** - How long each render takes
- **Call stack** - What triggered the render
- **Why each component rendered** - Props changed? Context changed? Parent re-rendered?

## Acceptance Criteria - Issue #1692

From the issue:
> A before and after profiler trace showing a measurable reduction in re-render count for sibling components when a single chat message arrives during an active stream session.

**Must Show:**
- [ ] Profiler trace before optimization (baseline)
- [ ] Profiler trace after optimization (improvement)
- [ ] Specific render count reduction for siblings (e.g., Sidebar: 6 → 0)
- [ ] Total render count reduction (e.g., 18 renders → 3 renders)
- [ ] Evidence that app still functions correctly with optimizations

## Implementation Priority

### Phase 1: Profiling & Analysis (REQUIRED FIRST)
1. Set up profiling environment
2. Create test scenario (test chat message)
3. Capture baseline profiler trace
4. Identify worst offenders
5. Document findings

### Phase 2: Targeted Fixes (NOT: Blanket memoization)
1. Fix highest-impact items first
2. Add memoization based on profiling
3. Test after each fix
4. Capture after profiler trace

### Phase 3: Validation
1. Compare before/after traces
2. Verify functionality unchanged
3. Monitor for performance regressions
4. Deploy with metrics

## Anti-Patterns to Avoid

**❌ Anti-Pattern 1: Premature Memoization**
```typescript
// Don't do this without profiling
const memoAll = (component) => React.memo(component);
export default memoAll(Dashboard);
```

**❌ Anti-Pattern 2: Over-complex Dependencies**
```typescript
// Don't create tight dependencies
useCallback(() => {
  // References 20 external variables
  doSomething(var1, var2, var3, ...var20);
}, [var1, var2, var3, ...var20]); // Recreates on every change
```

**❌ Anti-Pattern 3: Ignoring Context Structure**
```typescript
// Don't keep unrelated data in same context
<UserAndChatAndSettingsContext.Provider value={{...}}>
  {/* Everything re-renders on any change */}
</UserAndChatAndSettingsContext.Provider>
```

## Success Metrics

**After implementing memoization based on profiling:**

- [ ] Chat message arrival causes < 5 unnecessary re-renders
- [ ] Sidebar/navbar don't re-render on chat activity
- [ ] Stream preview tiles memoized properly
- [ ] Before/after profiler traces show measurable improvement
- [ ] No functionality broken by optimizations
- [ ] Build size unchanged or reduced

## Testing Approach

### Unit Tests
- Verify React.memo comparison functions work
- Test useCallback dependency arrays
- Test context split behavior

### Integration Tests
- Load live stream with chat
- Send 10 rapid messages
- Profile render counts
- Verify each optimization still works

### Performance Tests
- Baseline: X renders for chat update
- After fix: < X/2 renders for same update
- Sustained load test: No memory leaks
- Mobile performance: Not degraded

## Tools and Resources

- [React DevTools Profiler Docs](https://react.dev/learn/render-and-commit#react-devtools-profiler)
- [React.memo Documentation](https://react.dev/reference/react/memo)
- [useCallback Hook Guide](https://react.dev/reference/react/useCallback)
- [useMemo Hook Guide](https://react.dev/reference/react/useMemo)
- [Context Performance Optimization](https://react.dev/reference/react/createContext#optimizing-re-renders-when-passing-objects-and-functions)

## Related Issues

- Issue #1692 - Main issue for memoization profiling
- Related: Any performance regression reports on live chat

## Notes

- **Don't guess**: Always profile first
- **Measure impact**: Before/after traces are essential
- **Test thoroughly**: Memoization changes behavior subtly
- **Document findings**: Future developers need to understand optimization decisions
- **Monitor performance**: Set up alerts for render count regressions
