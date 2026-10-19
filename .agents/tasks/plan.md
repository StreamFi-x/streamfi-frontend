# Implementation Plan: Pre-Broadcast Stream-Health Diagnostics (#1179)

## Overview

This plan implements a pre-flight diagnostics system for StreamFi creators before going live. The feature exercises the real ingest path with actual encoder settings, measures sustained bitrate stability, and provides plain-language, actionable guidance without ever blocking the go-live action.

The system uses a warning-style UX (non-blocking), handles graceful degradation (warn and inform, never hard-block), and includes comprehensive tests for marginal results, service unavailability, and network mismatches.

---

## Architecture & Design Decisions

### Data Flow Architecture
```
1. Creator clicks "Run Diagnostics" (in StreamControls or new PreflightDiagnostics modal)
   ↓
2. Client calls POST /api/streams/diagnostics with:
   - wallet (from session)
   - encoderSettings: { bitrate, resolution, keyframeIntervalMs }
   ↓
3. Backend API handler (/app/api/streams/diagnostics/route.ts):
   - Verifies user session and stream exists
   - Calls diagnostic service (lib/diagnostics/service.ts)
   - Diagnostic service spins up a real test ingest to Mux
   - Measures bitrate stability over time (10-15 seconds)
   - Collects metrics (dropped frames, keyframe compliance, bitrate variance)
   ↓
4. Service returns diagnostic results with:
   - bitrate: { target, actual, variance, stability }
   - frames: { total, dropped, dropRate }
   - keyframes: { interval, expectedInterval, compliant }
   - networkQuality: { latency, jitter, packetLoss }
   - health: { status: 'good'|'marginal'|'poor', confidence }
   ↓
5. API transforms results into plain-language guidance:
   - "Your bitrate is stable" or "Lower your bitrate to X"
   - "Upload is unstable, try wired connection"
   - Severity level for UI coloring
   ↓
6. Client receives results and updates UI state via hook (useDiagnostics)
   ↓
7. Component (PreflightDiagnosticsPanel) renders non-blocking warning badge
   - Shows warnings with actionable guidance
   - Never prevents go-live (user can dismiss or proceed)
   - Integrates into StreamControls/modal with "Run Diagnostics" button
```

### Key Design Decisions

1. **Non-Blocking UX Pattern**: Diagnostics display as a warning banner/badge in StreamControls. Users can always proceed to go live regardless of results. This respects creator autonomy while informing them of potential issues.

2. **Real Test Ingest**: To measure *sustained* bitrate (not instantaneous), we must actually send data to Mux. The diagnostic service creates a temporary test stream and pumps synthetic frames to it for 10-15 seconds, collecting real bitrate/frame metrics from Mux's perspective.

3. **Encoder Settings as Input**: The diagnostics accept bitrate, resolution, and keyframe interval from the client. This allows testing against the *intended* encoder configuration before the creator connects OBS. Thresholds are applied based on these settings.

4. **Graceful Degradation Tiers**:
   - **Tier 1 (Success)**: Mux responds with stream metrics → full diagnostic results
   - **Tier 2 (Partial)**: Mux unreachable but network test passes → recommend manual verification
   - **Tier 3 (Fallback)**: All external services unavailable → show "service unavailable" warning, never block

5. **Guidance Generation**: Backend transforms metrics into plain-language recommendations. Thresholds are configurable (via environment or constants) and conservative (err on side of lowering bitrate when marginal).

6. **Marginality & Confidence**: Results include confidence scores. "Marginal" results (e.g., bitrate at 95% of target) show as warnings; "poor" results (bitrate <80% of target) show as errors. Confidence helps distinguish transient glitches from real constraints.

7. **Test Cleanup**: Diagnostic streams are temporary and self-destructing (deleted after metrics are collected or after a timeout).

---

## Implementation Plan

### Phase 1: Backend Diagnostic Service

#### 1.1 Create Core Diagnostic Service
   **What**: Create the diagnostic service library that handles test ingest setup, metric collection, and result interpretation.
   
   **Files**:
   - `lib/diagnostics/service.ts` — Main diagnostic orchestration
   - `lib/diagnostics/mux-ingest-simulator.ts` — Test stream creation and synthetic frame sending
   - `lib/diagnostics/metrics-analyzer.ts` — Bitrate stability, frame drop analysis
   - `lib/diagnostics/guidance-generator.ts` — Plain-language recommendations from metrics
   - `lib/diagnostics/types.ts` — Shared TypeScript interfaces
   
   **Details**:
   - `service.ts` exports `runDiagnostics(streamId, encoderSettings)` which orchestrates the test.
   - Create a temporary Mux live stream for the test.
   - Generate synthetic video frames matching the encoder settings (bitrate, resolution, keyframe interval).
   - Send frames at the target bitrate for 10-15 seconds.
   - Poll Mux's stream metrics periodically to collect bitrate, dropped frames, and status.
   - Analyze collected data to compute: bitrate variance, frame drop rate, keyframe compliance.
   - Generate health score and guidance.
   - Clean up the test stream.
   - Handle errors gracefully: if Mux fails, return partial results with confidence=low.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/service.test.ts` passes all unit tests (no integration required yet).

#### 1.2 Create Test Ingest Helper Library
   **What**: Implement synthetic frame generation and Mux stream interaction for test ingest.
   
   **Files**:
   - `lib/diagnostics/mux-ingest-simulator.ts` — Helpers for test stream creation, frame encoding, bitrate control
   
   **Details**:
   - Reuse `createMuxStream()` from `lib/mux/server.ts` but with a test passthrough marker.
   - Generate minimal H.264 frames in JavaScript (or use a lightweight codec library if available).
   - Implement bitrate pacing: send bytes at the target rate (e.g., 5Mbps = 625 KB/s).
   - Implement keyframe insertion at the specified interval.
   - Provide a `sendTestFrames(streamId, encoderSettings, durationMs)` function that pumps frames and returns collected metrics.
   - Track actual bitrate achieved, frame count, and any errors.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/mux-ingest-simulator.test.ts` — unit tests for frame generation and bitrate pacing.

#### 1.3 Create Metrics Analysis Library
   **What**: Implement bitrate stability calculation and frame drop rate analysis.
   
   **Files**:
   - `lib/diagnostics/metrics-analyzer.ts` — Analyze collected metrics for stability and health.
   
   **Details**:
   - Compute bitrate variance (actual vs. target over time).
   - Calculate frame drop rate (dropped frames / total frames).
   - Check keyframe compliance: verify keyframes are inserted at the expected interval ±10%.
   - Compute a health score:
     - bitrate variance < 5% → excellent
     - 5% – 15% → good
     - 15% – 30% → marginal
     - > 30% → poor
   - Similar scoring for frame drop rate and keyframe compliance.
   - Return: `{ bitrate, frames, keyframes, health, confidence, networkQuality }`.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/metrics-analyzer.test.ts` — test borderline thresholds, edge cases (0 frames, all dropped, etc.).

#### 1.4 Create Guidance Generation Library
   **What**: Transform metrics into plain-language, actionable recommendations.
   
   **Files**:
   - `lib/diagnostics/guidance-generator.ts` — Generate user-facing guidance.
   
   **Details**:
   - Map diagnostic results to plain-language messages:
     - Bitrate unstable → "Your upload is unstable. Consider a wired connection."
     - Bitrate too low → "Lower your bitrate to X Kbps to match your upload speed."
     - Keyframe issues → "Your encoder may not be inserting keyframes correctly."
     - Dropped frames → "Your encoder or network is dropping frames."
   - Include severity: 'info', 'warning', 'error'.
   - Return guidance as an array of plain-text suggestions.
   - Include a "Summary" line for the UI badge.
   - Never recommend *preventing* the stream; only advise on optimization.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/guidance-generator.test.ts` — test guidance generation for various diagnostic outcomes.

### Phase 2: Backend API Endpoint

#### 2.1 Create Diagnostics API Route
   **What**: Create the API endpoint that clients call to run diagnostics.
   
   **Files**:
   - `app/api/streams/diagnostics/route.ts` — POST /api/streams/diagnostics
   
   **Details**:
   - Accept POST body: `{ encoderSettings: { bitrate, resolution, keyframeIntervalMs } }`
   - Verify session and get user's stream ID from DB.
   - Call `runDiagnostics(streamId, encoderSettings)` from the service.
   - Handle errors:
     - Mux service unavailable (503) → return partial results with confidence=low and a "service unavailable" message.
     - Invalid encoder settings → return 400 with validation errors.
     - User stream not found → return 404.
   - Return: `{ success: true, results: { ... }, guidance: [ ... ], timestamp }`
   - Rate limit: 1 diagnostic per minute per user (to avoid resource exhaustion).
   
   **Verify**: Run the route's tests; confirm it handles all error cases gracefully and rate limiting works.

### Phase 3: Client-Side Hooks & State Management

#### 3.1 Create Diagnostics Hook
   **What**: Implement a React hook for running and managing diagnostic state on the client.
   
   **Files**:
   - `hooks/useDiagnostics.ts` — Hook for running diagnostics and managing results
   
   **Details**:
   - Export `useDiagnostics()` which returns:
     - `run(encoderSettings)` — async function to call the API
     - `results` — latest diagnostic results (or null)
     - `guidance` — plain-language guidance array
     - `isLoading` — true while diagnostics are running
     - `error` — error message if the request failed
     - `timestamp` — when diagnostics were last run
   - Use SWR or direct fetch; prefer SWR for consistency with the codebase.
   - Cache results for 5 minutes to avoid repeated API calls with same settings.
   - Provide a `reset()` function to clear results.
   
   **Verify**: `npm run test -- __tests__/hooks/useDiagnostics.test.ts` — test hook behavior: loading state, error handling, caching.

### Phase 4: UI Components

#### 4.1 Create Prelight Diagnostics Panel Component
   **What**: Implement the UI component that displays diagnostic results and guidance.
   
   **Files**:
   - `components/dashboard/stream-manager/PreflightDiagnosticsPanel.tsx` — Panel component for diagnostics UI
   
   **Details**:
   - Render as a collapsible panel or modal in the StreamControls area (or integrated into go-live flow).
   - Display:
     - Input fields for encoder settings (bitrate, resolution, keyframe interval) with sensible defaults.
     - "Run Diagnostics" button (disabled while running, shows spinner).
     - Results summary when available: health status, key metrics, guidance.
     - Guidance list: each item is a plain-text recommendation, color-coded by severity.
   - Never block the "Go Live" button. Diagnostics are advisory only.
   - Use existing UI patterns from the codebase (Button, card-based layouts, toast for errors).
   - Show result timestamp so users know results are fresh.
   - Include a "Learn More" link to docs explaining diagnostics (or inline tooltip).
   
   **Verify**: Storybook or component snapshot tests; manual verification in the dev environment.

#### 4.2 Integrate into StreamControls
   **What**: Add diagnostics trigger and results display to the existing StreamControls component.
   
   **Files**:
   - Modify `components/dashboard/stream-manager/StreamControls.tsx` — Integrate diagnostics panel
   
   **Details**:
   - Add a "Run Diagnostics" button or link in StreamControls (or in a collapsible "Advanced" section).
   - When clicked, toggle the PreflightDiagnosticsPanel.
   - Display a small warning badge if recent diagnostics show issues, e.g., "⚠️ Unstable Upload".
   - Badge is subtle and informative, never alarming or blocking.
   - Keep the "Start Stream" button always functional.
   
   **Verify**: Component tests or manual testing in dev environment.

### Phase 5: Comprehensive Testing

#### 5.1 Test Marginal/Borderline Results
   **What**: Verify diagnostics correctly classify marginal results (e.g., 95% of target bitrate).
   
   **Files**:
   - Tests in `__tests__/lib/diagnostics/metrics-analyzer.test.ts`
   - Tests in `__tests__/lib/diagnostics/guidance-generator.test.ts`
   - Integration test: `__tests__/app/api/streams/diagnostics.test.ts`
   
   **Details**:
   - Test bitrate variance at threshold boundaries: 4%, 5%, 15%, 16%, 30%, 31%.
   - Test frame drop rates at boundaries.
   - Test keyframe compliance edge cases (off by 10%, off by 11%).
   - Verify guidance appropriately escalates severity (info → warning → error).
   - Verify confidence scores are reasonable.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/ --testNamePattern="marginal|borderline|threshold"` passes.

#### 5.2 Test Service Unavailability
   **What**: Verify graceful degradation when Mux or other services are unavailable.
   
   **Files**:
   - Test in `__tests__/lib/diagnostics/service.test.ts`
   - Test in `__tests__/app/api/streams/diagnostics.test.ts`
   
   **Details**:
   - Mock Mux service to return errors (503, timeouts, connection refused).
   - Verify the diagnostic service returns partial results with low confidence.
   - Verify the API returns 200 with a "service unavailable" guidance message (never 503 or error).
   - Verify the UI gracefully shows "Diagnostics unavailable" without blocking go-live.
   - Test recovery: once service is back, diagnostics work again.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/service.test.ts --testNamePattern="unavailable|error|failure"` passes.

#### 5.3 Test Network Condition Mismatches
   **What**: Verify diagnostics accurately reflect network constraints and encoder misconfiguration.
   
   **Files**:
   - Test in `__tests__/lib/diagnostics/mux-ingest-simulator.test.ts`
   - Test in `__tests__/app/api/streams/diagnostics.test.ts`
   
   **Details**:
   - Simulate encoder targeting 10 Mbps on a 2 Mbps connection → guidance: "Lower your bitrate".
   - Simulate keyframe interval mismatch (encoder every 5s, test expects 2s).
   - Simulate high packet loss (20% dropped frames).
   - Simulate high latency (jitter causing bitrate fluctuations).
   - Verify guidance appropriately identifies the issue and suggests a fix.
   - Test conflicting signals (e.g., bitrate OK but frames dropping) → guidance prioritizes the worse issue.
   
   **Verify**: `npm run test -- __tests__/lib/diagnostics/ --testNamePattern="network|mismatch|constraint"` passes.

#### 5.4 Test UI Warning-Not-Blocking Behavior
   **What**: Verify the UI never blocks go-live based on diagnostics.
   
   **Files**:
   - Test in `__tests__/components/dashboard/stream-manager/PreflightDiagnosticsPanel.test.tsx`
   - Integration test: `__tests__/components/dashboard/stream-manager/StreamControls.test.tsx`
   
   **Details**:
   - Verify "Start Stream" button is always clickable (even with error diagnostics).
   - Verify diagnostics panel can be dismissed.
   - Verify warning badge doesn't cover or interfere with go-live button.
   - Test that user can go live without running diagnostics at all.
   - Verify guidance is displayed but is not a modal or blocker.
   
   **Verify**: Component tests pass; manual UI testing in dev environment.

#### 5.5 Test Hook State Management
   **What**: Verify the useDiagnostics hook correctly manages loading, caching, and error states.
   
   **Files**:
   - Test in `__tests__/hooks/useDiagnostics.test.ts`
   
   **Details**:
   - Test loading state transitions.
   - Test cache behavior: same encoder settings → cached result; different settings → new API call.
   - Test error recovery: failed call, then retry with fix.
   - Test concurrent calls (only one should run at a time).
   - Test reset() function clears cache.
   
   **Verify**: `npm run test -- __tests__/hooks/useDiagnostics.test.ts` passes.

---

## File Structure Summary

### New Files (by phase)

**Phase 1 – Backend Service:**
- `lib/diagnostics/types.ts`
- `lib/diagnostics/service.ts`
- `lib/diagnostics/mux-ingest-simulator.ts`
- `lib/diagnostics/metrics-analyzer.ts`
- `lib/diagnostics/guidance-generator.ts`
- `lib/diagnostics/__tests__/service.test.ts`
- `lib/diagnostics/__tests__/mux-ingest-simulator.test.ts`
- `lib/diagnostics/__tests__/metrics-analyzer.test.ts`
- `lib/diagnostics/__tests__/guidance-generator.test.ts`

**Phase 2 – Backend API:**
- `app/api/streams/diagnostics/route.ts`
- `__tests__/app/api/streams/diagnostics.test.ts`

**Phase 3 – Client Hook:**
- `hooks/useDiagnostics.ts`
- `__tests__/hooks/useDiagnostics.test.ts`

**Phase 4 – UI Components:**
- `components/dashboard/stream-manager/PreflightDiagnosticsPanel.tsx`
- `__tests__/components/dashboard/stream-manager/PreflightDiagnosticsPanel.test.tsx`

### Modified Files

- `components/dashboard/stream-manager/StreamControls.tsx` — Add diagnostics panel integration and warning badge
- `__tests__/components/dashboard/stream-manager/StreamControls.test.tsx` — Update existing tests to account for new diagnostics UI

---

## Testing Summary

| Test File | Scope | Key Scenarios |
|-----------|-------|---|
| `lib/diagnostics/__tests__/service.test.ts` | Service orchestration | Success, Mux timeout, partial results, cleanup |
| `lib/diagnostics/__tests__/mux-ingest-simulator.test.ts` | Frame generation, bitrate pacing | Bitrate at target, undershooting, overshooting, keyframe intervals |
| `lib/diagnostics/__tests__/metrics-analyzer.test.ts` | Metric analysis | Bitrate variance boundaries, frame drop rates, confidence scoring |
| `lib/diagnostics/__tests__/guidance-generator.test.ts` | Guidance generation | Severity escalation, plain-language output, edge cases |
| `__tests__/app/api/streams/diagnostics.test.ts` | API endpoint | Auth, rate limiting, Mux unavailability, invalid input |
| `__tests__/hooks/useDiagnostics.test.ts` | Client hook | Loading, caching, error recovery, concurrent calls |
| `__tests__/components/dashboard/stream-manager/PreflightDiagnosticsPanel.test.tsx` | Component rendering | Input handling, results display, guidance formatting |
| `__tests__/components/dashboard/stream-manager/StreamControls.test.tsx` | Integration | Diagnostics not blocking go-live, badge display |

---

## Verification Strategy

### Build & Lint
- `npm run build` — Full Next.js build with no type errors
- `npm run lint` — ESLint passes with no warnings

### Test Execution
- `npm run test -- __tests__/lib/diagnostics/` — All diagnostic library tests pass
- `npm run test -- __tests__/app/api/streams/diagnostics.test.ts` — API tests pass
- `npm run test -- __tests__/hooks/useDiagnostics.test.ts` — Hook tests pass
- `npm run test -- __tests__/components/dashboard/stream-manager/` — Component tests pass
- `npm run test:coverage` — Coverage meets project thresholds

### Manual Testing
- Start dev server: `npm run dev`
- Navigate to StreamControls component (dashboard or stream manager)
- Verify "Run Diagnostics" button is present and clickable
- Run diagnostics with valid encoder settings (e.g., 5000 kbps, 1080p)
- Verify results display without blocking go-live
- Verify "Start Stream" button remains clickable throughout
- Simulate Mux outage (mock in dev) and verify graceful handling
- Verify warning badge appears when diagnostics show issues

---

## Thresholds & Configuration

These are conservative defaults and can be tuned via environment variables or configuration files:

| Metric | Excellent | Good | Marginal | Poor |
|--------|-----------|------|----------|------|
| Bitrate Variance | < 5% | 5-15% | 15-30% | > 30% |
| Frame Drop Rate | 0% | < 1% | 1-5% | > 5% |
| Keyframe Compliance | 100% ± 0% | 100% ± 5% | 100% ± 10% | > 10% off |
| Latency/Jitter | Low | Moderate | High | Very High |

---

## Graceful Degradation Tiers

1. **Tier 1 (Full Diagnostics)**: All systems operational → return complete metrics and guidance
2. **Tier 2 (Partial)**: Mux unavailable but basic network test passes → return "Please verify manually" guidance
3. **Tier 3 (Fallback)**: All services unavailable → return "Diagnostics unavailable, proceed at your discretion" message

**User Experience**: In all tiers, go-live button is always clickable. Diagnostics inform but never mandate.

---

## Dependencies & Tools

- Existing: `@mux/mux-node`, `sonner` (for toast), `next`, `react`, `jest`, `swr`
- May need: Lightweight H.264 encoder library if synthetic frame generation is complex (TBD during implementation)
- No new major dependencies; reuse existing patterns from codebase

---

## Success Criteria

✅ Diagnostics exercise real ingest path with actual encoder settings  
✅ Bitrate stability measured over sustained time window (10-15 seconds)  
✅ Plain-language, actionable guidance generated from results  
✅ Non-blocking warning UX: never prevents go-live  
✅ Graceful degradation: warn and inform, never hard-block  
✅ Comprehensive tests for marginal results, service unavailability, network mismatches  
✅ All tests pass; build and lint pass; no type errors  
✅ Manual testing confirms UI behavior and non-blocking nature  

---

**Next Steps**: 
1. Implement Phase 1 (Backend Service) with tests
2. Implement Phase 2 (Backend API) with tests
3. Implement Phase 3 (Client Hook) with tests
4. Implement Phase 4 (UI Components) with tests and manual verification
5. Run full test suite and manual integration testing
6. Code review and merge to main branch

