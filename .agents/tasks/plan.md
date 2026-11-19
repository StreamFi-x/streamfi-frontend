# Implementation Plan: Real-Time Stream Quality Degradation Alerting (Issue #1169)

## Overview
This plan implements real-time stream health monitoring and alerting for StreamFi creators during live broadcasts. The system periodically polls Mux stream health data and displays a non-intrusive live indicator in the broadcast UI, alerting creators to quality degradation (encoder issues, upload problems, or Mux-side issues).

## Design Decisions

### 1. Client-polling vs Server-push
**Decision**: Client-side polling at 15-second intervals using `setInterval` (not SWR).

**Rationale**: 
- The existing codebase has no WebSocket/SSE infrastructure, adding SSE would be a larger undertaking.
- 15-second latency is acceptable for stream health alerts (not critical real-time like viewer counts).
- `setInterval` is chosen over SWR's refresh strategy because we need precise start/stop tied to the `isLive` flag; SWR's deduplication and stale-while-revalidate would complicate conditional polling.
- Simple, maintainable, and doesn't require new infrastructure or database state.

### 2. Circular buffer for degradation detection
**Decision**: Maintain a circular buffer of the last 3 health readings (45 seconds total at 15s interval).

**Rationale**:
- Prevents false positives from single transient failures.
- `alertLevel='warning'` triggers when 2+ of 3 readings show degradation (not 1-of-1).
- `alertLevel='critical'` triggers when all 3 readings are bad.
- Simple, stateful, and doesn't require external storage.

### 3. Graceful unavailability handling
**Decision**: After 3 consecutive poll failures, set `isDataAvailable=false` and `healthStatus='unavailable'` without crashing.

**Rationale**:
- Network glitches or temporary unavailability shouldn't crash the UI.
- Streaming can continue even if health data is unavailable.
- The UI shows a grey indicator rather than an error state.

### 4. Cause attribution heuristics
**Decision**: Simple deterministic heuristics based on Mux status + reconnectWindow.

- If Mux status is `idle` or `not_found` → `'mux-side'`
- If status is `active` but `reconnectWindow <= 10s` → `'encoder'` (encoder dropped and reconnected)
- Otherwise → `'upload'` (possible upstream network issue)

**Rationale**:
- No access to encoder logs, so we infer from available Mux state.
- These heuristics are "best-effort" guidance for creators, not ground truth.
- More sophisticated analysis would require encoder telemetry (future enhancement).

---

## Implementation Items

- [ ] 1. Create `app/api/streams/health/route.ts` — new API route wrapping `getMuxStreamHealth()` for client polling.
      
      **What**: Add a new POST endpoint that accepts a `streamId` query parameter, calls `getMuxStreamHealth()` server-side, and returns the health data as JSON. Authenticate via `verifySession` to prevent unauthenticated polling abuse. Return HTTP 401 if session invalid, 404 if stream not found, 200 with health data on success.
      
      **Files**: `app/api/streams/health/route.ts`
      
      **Verify**: `npm test -- app/api/streams/health` (no tests yet, just confirm compilation and no linting errors)

- [ ] 2. Create `hooks/useLiveStreamHealth.ts` — client-side hook for polling and degradation detection.
      
      **What**: Implement a React hook that:
      - Polls `/api/streams/health?streamId={streamId}` on a 15-second interval via `setInterval` (only while `isLive === true`)
      - Maintains a circular buffer of last 3 readings
      - Exports: `healthStatus` ('good'|'degraded'|'unavailable'), `alertLevel` ('none'|'warning'|'critical'), `likelyCause` ('encoder'|'upload'|'mux-side'|'unknown'), `isDataAvailable` boolean, `lastCheckedAt` timestamp, `readings` array
      - Degradation thresholds: 2+ of 3 readings bad → `alertLevel='warning'`; all 3 bad → `alertLevel='critical'`; 3 consecutive fetch failures → `isDataAvailable=false`
      - Apply cause heuristics: mux status idle/not-found → 'mux-side', active + reconnectWindow ≤10s → 'encoder', else → 'upload'
      - Gracefully handle network errors without crashing
      - Stop polling immediately when `isLive` goes false
      
      **Files**: `hooks/useLiveStreamHealth.ts`
      
      **Verify**: `npm test -- hooks/useLiveStreamHealth` (runs the test suite in __tests__/hooks/useLiveStreamHealth.test.ts, which tests threshold detection, polling lifecycle, and cause heuristics)

- [ ] 3. Create `components/dashboard/stream-manager/LiveHealthIndicator.tsx` — non-intrusive status bar component.
      
      **What**: Render a compact status indicator that:
      - Only appears when `isLive === true`
      - Shows a colored dot/badge: green (good), yellow (warning), red (critical), grey (unavailable)
      - Shows `likelyCause` label when `alertLevel !== 'none'` (e.g., "⚠️ Encoder issue")
      - Shows `lastCheckedAt` timestamp
      - Does NOT call Mux APIs itself; only consumes hook output
      - Uses existing Lucide icons and Tailwind classes for styling
      
      **Files**: `components/dashboard/stream-manager/LiveHealthIndicator.tsx`
      
      **Verify**: Manual component render test; verify it matches the snapshot/style by running `npm run build` (TypeScript check passes)

- [ ] 4. Integrate `LiveHealthIndicator` into `StreamControls.tsx`.
      
      **What**: Import `useLiveStreamHealth` hook and `LiveHealthIndicator` component. Call the hook when `liveState === true`, passing hook output to the component. Render above the stream control buttons when active.
      
      **Files**: `components/dashboard/stream-manager/StreamControls.tsx`
      
      **Verify**: `npm run build` (TypeScript check passes); manual test in browser to confirm indicator appears when live and disappears when offline

- [ ] 5. Create `__tests__/hooks/useLiveStreamHealth.test.ts` — comprehensive test suite.
      
      **What**: Unit tests covering:
      - Initial state: `healthStatus='unavailable'`, `alertLevel='none'`, `isDataAvailable=false`
      - Poll lifecycle: polling starts when `isLive` goes true, stops when it goes false
      - Threshold detection: 2-of-3 readings bad → `alertLevel='warning'`; 3-of-3 bad → `alertLevel='critical'`; all 3 good → `alertLevel='none'`
      - Graceful unavailability: 3 consecutive fetch errors → `isDataAvailable=false`, hook keeps running but shows grey indicator
      - Cause heuristics for each variant: mux-side, encoder, upload
      - Circular buffer correctly evicts old readings
      - lastCheckedAt timestamp updates on each successful poll
      
      **Files**: `__tests__/hooks/useLiveStreamHealth.test.ts`
      
      **Verify**: `npm test -- __tests__/hooks/useLiveStreamHealth.test.ts` — all tests pass

- [ ] 6. Verify integration end-to-end.
      
      **What**: Run full build and type check to confirm no TypeScript errors, linting errors, or import path issues. Compile the application and verify StreamControls + LiveHealthIndicator integrate properly.
      
      **Files**: (compilation target)
      
      **Verify**: `npm run build` and `npm run type-check` both pass; `npm test -- __tests__/hooks/useLiveStreamHealth.test.ts` passes

---

## Type Signatures (High-Level)

### `useLiveStreamHealth` hook

```typescript
interface LiveHealthReading {
  timestamp: number;
  status: 'active' | 'idle' | 'not_found';
  reconnectWindow: number | null;
}

interface UseLiveStreamHealthReturn {
  healthStatus: 'good' | 'degraded' | 'unavailable';
  alertLevel: 'none' | 'warning' | 'critical';
  likelyCause: 'encoder' | 'upload' | 'mux-side' | 'unknown';
  isDataAvailable: boolean;
  lastCheckedAt: Date | null;
  readings: LiveHealthReading[];
}

function useLiveStreamHealth(streamId: string, isLive: boolean): UseLiveStreamHealthReturn
```

### `LiveHealthIndicator` component

```typescript
interface LiveHealthIndicatorProps {
  healthStatus: 'good' | 'degraded' | 'unavailable';
  alertLevel: 'none' | 'warning' | 'critical';
  likelyCause: 'encoder' | 'upload' | 'mux-side' | 'unknown';
  isDataAvailable: boolean;
  lastCheckedAt: Date | null;
}

function LiveHealthIndicator(props: LiveHealthIndicatorProps): React.ReactElement
```

### `POST /api/streams/health` route

**Request**: `GET /api/streams/health?streamId={streamId}`  
**Response** (200):
```json
{
  "streamId": "string",
  "isActive": boolean,
  "status": "active" | "idle" | "disabled",
  "reconnectWindow": number | null,
  "latencyMode": string,
  "createdAt": string | null
}
```

---

## Threshold Logic (Pseudocode)

```
readings = circular_buffer[3]  // last 3 health checks

bad_readings = count(readings where status != 'active' or reconnectWindow is very low)

if bad_readings == 0:
  alertLevel = 'none'
else if bad_readings < 3:
  alertLevel = 'warning'
else:
  alertLevel = 'critical'

if readings[-1].status == 'idle' or status == 'not_found':
  likelyCause = 'mux-side'
else if readings[-1].status == 'active' and reconnectWindow <= 10:
  likelyCause = 'encoder'
else if alertLevel != 'none':
  likelyCause = 'upload'
else:
  likelyCause = 'unknown'

if consecutive_fetch_failures >= 3:
  isDataAvailable = false
  healthStatus = 'unavailable'
else if isDataAvailable and alertLevel != 'none':
  healthStatus = 'degraded'
else if isDataAvailable:
  healthStatus = 'good'
```

---

## Files Created/Modified

**New files:**
- `app/api/streams/health/route.ts`
- `hooks/useLiveStreamHealth.ts`
- `components/dashboard/stream-manager/LiveHealthIndicator.tsx`
- `__tests__/hooks/useLiveStreamHealth.test.ts`

**Modified files:**
- `components/dashboard/stream-manager/StreamControls.tsx` (integration)

---

## Notes

1. **Polling interval**: 15 seconds is chosen as a balance between responsiveness and server load. Can be made configurable in future iterations.
2. **Circular buffer size**: 3 readings (45 seconds) is chosen to filter transient spikes. Can be tuned based on creator feedback.
3. **reconnectWindow threshold**: 10 seconds is a heuristic; if encoder reconnects faster than this, it's likely a stable encoder with a brief hiccup.
4. **Future enhancements**:
   - Add WebSocket/SSE for real-time updates (if infrastructure supports it)
   - Persist health history to database for analytics
   - Add detailed cause attribution with encoder telemetry
   - Create admin dashboard to view platform-wide stream health
5. **Testing strategy**: Unit tests cover the hook logic thoroughly; component rendering is tested via build/type-check and manual verification (not automated due to Tailwind + Lucide complexity in Jest).
