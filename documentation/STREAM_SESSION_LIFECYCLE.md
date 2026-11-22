# Stream Session Lifecycle Management

## Overview

This document defines the lifecycle states and transitions for live streaming sessions in StreamFi, ensuring consistent state management across the platform.

## Related Issues

This documentation addresses stream session management requirements from issue #1818.

## Session States

### State Definitions

| State | Description | Duration |
|-------|-------------|----------|
| `idle` | Stream created but not started | Indefinite |
| `starting` | Stream initialization in progress | ~5-30 seconds |
| `active` | Stream is live and broadcasting | Variable |
| `stopping` | Stream shutdown in progress | ~5-15 seconds |
| `stopped` | Stream ended cleanly | Terminal |
| `error` | Stream encountered an error | Terminal |

### State Diagram

```
┌──────┐     start      ┌──────────┐    success    ┌────────┐
│ idle │ ─────────────> │ starting │ ────────────> │ active │
└──────┘                └──────────┘               └────────┘
   ^                         │                          │
   │                         │ error                    │ stop
   │                         v                          v
   │                    ┌───────┐               ┌──────────┐
   │                    │ error │               │ stopping │
   │                    └───────┘               └──────────┘
   │                         │                       │   │
   │                         │                       │   │ error
   │        reset            │         success       │   v
   └─────────────────────────┴───────────────────────┘ ┌───────┐
                                          │            │ error │
                                          v            └───────┘
                                     ┌─────────┐
                                     │ stopped │
                                     └─────────┘
```

## State Transitions

### Allowed Transitions

```typescript
type StreamState = "idle" | "starting" | "active" | "stopping" | "stopped" | "error";

const ALLOWED_TRANSITIONS: Record<StreamState, StreamState[]> = {
  idle: ["starting"],
  starting: ["active", "error"],
  active: ["stopping", "error"],
  stopping: ["stopped", "error"],
  stopped: ["idle"], // For stream reset/reuse
  error: ["idle"],   // For recovery
};

function isValidTransition(from: StreamState, to: StreamState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Transition Examples

#### Starting a Stream

```typescript
async function startStream(streamId: string): Promise<void> {
  const stream = await getStream(streamId);
  
  if (stream.state !== "idle") {
    throw new Error(`Cannot start stream in state: ${stream.state}`);
  }

  await updateStreamState(streamId, "starting");

  try {
    // Initialize Mux live stream
    await initializeMuxStream(streamId);
    
    // Start health monitoring
    await startHealthMonitoring(streamId);
    
    // Transition to active
    await updateStreamState(streamId, "active");
    
    // Notify subscribers
    await publishRealtimeMessage(
      `stream:${streamId}:status`,
      "stream:started",
      { streamId, timestamp: Date.now() }
    );
  } catch (error) {
    await updateStreamState(streamId, "error", error.message);
    throw error;
  }
}
```

#### Stopping a Stream

```typescript
async function stopStream(streamId: string): Promise<void> {
  const stream = await getStream(streamId);
  
  if (stream.state !== "active") {
    throw new Error(`Cannot stop stream in state: ${stream.state}`);
  }

  await updateStreamState(streamId, "stopping");

  try {
    // Stop accepting new viewers
    await closeStreamToNewViewers(streamId);
    
    // Finalize recordings
    await finalizeRecordings(streamId);
    
    // Stop health monitoring
    await stopHealthMonitoring(streamId);
    
    // Cleanup Mux resources
    await cleanupMuxStream(streamId);
    
    // Transition to stopped
    await updateStreamState(streamId, "stopped");
    
    // Notify subscribers
    await publishRealtimeMessage(
      `stream:${streamId}:status`,
      "stream:stopped",
      { streamId, timestamp: Date.now() }
    );
  } catch (error) {
    await updateStreamState(streamId, "error", error.message);
    throw error;
  }
}
```

## State Validation

### Pre-Transition Validation

```typescript
interface StateTransitionContext {
  streamId: string;
  fromState: StreamState;
  toState: StreamState;
  timestamp: number;
  reason?: string;
}

async function validateStateTransition(
  context: StateTransitionContext
): Promise<{ valid: boolean; error?: string }> {
  // Check if transition is allowed
  if (!isValidTransition(context.fromState, context.toState)) {
    return {
      valid: false,
      error: `Invalid transition from ${context.fromState} to ${context.toState}`,
    };
  }

  // Additional business logic validations
  if (context.toState === "active") {
    const hasValidStreamKey = await checkStreamKey(context.streamId);
    if (!hasValidStreamKey) {
      return { valid: false, error: "Invalid stream key" };
    }
  }

  if (context.toState === "stopping") {
    const hasActiveViewers = await checkActiveViewers(context.streamId);
    // Allow stopping even with active viewers, but log for analytics
    if (hasActiveViewers) {
      await logEvent("stream_stopped_with_viewers", context);
    }
  }

  return { valid: true };
}
```

### State Consistency Checks

```typescript
interface StateConsistencyCheck {
  streamId: string;
  expectedState: StreamState;
  actualState: StreamState;
  muxState?: string;
  timestamp: number;
}

async function checkStateConsistency(
  streamId: string
): Promise<StateConsistencyCheck> {
  const dbState = await getStreamStateFromDB(streamId);
  const muxState = await getMuxStreamState(streamId);
  
  const check: StateConsistencyCheck = {
    streamId,
    expectedState: dbState,
    actualState: dbState,
    muxState,
    timestamp: Date.now(),
  };

  // Detect inconsistencies
  if (dbState === "active" && muxState === "idle") {
    check.actualState = "error";
    await reconcileState(streamId, "active", muxState);
  }

  return check;
}
```

## State Persistence

### Database Schema

```sql
CREATE TABLE stream_sessions (
  id UUID PRIMARY KEY,
  stream_id VARCHAR(255) NOT NULL,
  state VARCHAR(20) NOT NULL,
  previous_state VARCHAR(20),
  error_message TEXT,
  started_at TIMESTAMP,
  stopped_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_state CHECK (
    state IN ('idle', 'starting', 'active', 'stopping', 'stopped', 'error')
  )
);

CREATE INDEX idx_stream_sessions_stream_id ON stream_sessions(stream_id);
CREATE INDEX idx_stream_sessions_state ON stream_sessions(state);
```

### State History

```typescript
interface StateHistoryEntry {
  streamId: string;
  fromState: StreamState;
  toState: StreamState;
  timestamp: number;
  duration: number; // Time in previous state (ms)
  reason?: string;
}

async function recordStateTransition(
  streamId: string,
  fromState: StreamState,
  toState: StreamState,
  reason?: string
): Promise<void> {
  const previousTransition = await getLastStateTransition(streamId);
  
  const duration = previousTransition
    ? Date.now() - previousTransition.timestamp
    : 0;

  const entry: StateHistoryEntry = {
    streamId,
    fromState,
    toState,
    timestamp: Date.now(),
    duration,
    reason,
  };

  await insertStateHistory(entry);
  
  // Emit metrics
  await emitMetric("stream_state_transition", {
    fromState,
    toState,
    duration,
  });
}
```

## Error Handling

### Error State Recovery

```typescript
async function handleErrorState(
  streamId: string,
  error: Error
): Promise<void> {
  const stream = await getStream(streamId);
  
  await updateStreamState(streamId, "error", error.message);
  
  // Log error details
  await logError("stream_error", {
    streamId,
    previousState: stream.state,
    error: error.message,
    stack: error.stack,
  });
  
  // Notify stream owner
  await notifyStreamOwner(streamId, {
    type: "stream_error",
    message: error.message,
  });
  
  // Cleanup resources
  await cleanupStreamResources(streamId);
  
  // Schedule automatic recovery (optional)
  if (shouldAttemptRecovery(error)) {
    await scheduleRecovery(streamId, { delay: 30000 }); // 30 seconds
  }
}
```

### Timeout Handling

```typescript
const STATE_TIMEOUTS = {
  starting: 30000, // 30 seconds
  stopping: 15000, // 15 seconds
};

async function monitorStateTimeout(
  streamId: string,
  state: StreamState
): Promise<void> {
  const timeout = STATE_TIMEOUTS[state];
  if (!timeout) return;

  await sleep(timeout);
  
  const currentState = await getStreamState(streamId);
  
  if (currentState === state) {
    // State transition timed out
    await handleErrorState(
      streamId,
      new Error(`State transition timeout: ${state}`)
    );
  }
}
```

## Monitoring and Metrics

### Key Metrics

```typescript
interface StreamStateMetrics {
  // State distribution
  idleCount: number;
  startingCount: number;
  activeCount: number;
  stoppingCount: number;
  stoppedCount: number;
  errorCount: number;
  
  // Transition metrics
  averageStartingDuration: number;
  averageStoppingDuration: number;
  averageStreamDuration: number;
  
  // Error rates
  startFailureRate: number;
  stopFailureRate: number;
  unexpectedErrorRate: number;
}
```

### Health Checks

```typescript
async function checkStreamHealth(streamId: string): Promise<HealthStatus> {
  const stream = await getStream(streamId);
  
  if (stream.state === "error") {
    return { healthy: false, reason: stream.errorMessage };
  }
  
  if (stream.state === "active") {
    const muxState = await getMuxStreamState(streamId);
    if (muxState !== "active") {
      return {
        healthy: false,
        reason: `State mismatch: DB=${stream.state}, Mux=${muxState}`,
      };
    }
  }
  
  // Check if stuck in transitional state
  const stateAge = Date.now() - stream.updatedAt.getTime();
  if (
    (stream.state === "starting" && stateAge > 60000) ||
    (stream.state === "stopping" && stateAge > 30000)
  ) {
    return {
      healthy: false,
      reason: `Stuck in ${stream.state} for ${stateAge}ms`,
    };
  }
  
  return { healthy: true };
}
```

## Testing

### Unit Tests

```typescript
describe("Stream state transitions", () => {
  it("validates allowed state transitions", () => {
    expect(isValidTransition("idle", "starting")).toBe(true);
    expect(isValidTransition("starting", "active")).toBe(true);
    expect(isValidTransition("active", "stopping")).toBe(true);
    expect(isValidTransition("stopping", "stopped")).toBe(true);
    
    // Invalid transitions
    expect(isValidTransition("idle", "active")).toBe(false);
    expect(isValidTransition("active", "idle")).toBe(false);
    expect(isValidTransition("stopped", "active")).toBe(false);
  });

  it("ensures no duplicate states in allowed transitions", () => {
    const validStates = ["idle", "starting", "active", "stopping", "stopped", "error"];
    expect(new Set(validStates).size).toBe(validStates.length);
  });
});
```

### Integration Tests

```typescript
describe("Stream lifecycle", () => {
  it("completes full lifecycle: idle -> starting -> active -> stopping -> stopped", async () => {
    const streamId = "test-stream-123";
    
    // Create stream (idle)
    await createStream(streamId);
    expect(await getStreamState(streamId)).toBe("idle");
    
    // Start stream
    await startStream(streamId);
    expect(await getStreamState(streamId)).toBe("active");
    
    // Stop stream
    await stopStream(streamId);
    expect(await getStreamState(streamId)).toBe("stopped");
  });

  it("handles errors during starting", async () => {
    const streamId = "test-stream-error";
    
    await createStream(streamId);
    
    // Simulate Mux failure
    jest.spyOn(mux, "initializeStream").mockRejectedValue(new Error("Mux error"));
    
    await expect(startStream(streamId)).rejects.toThrow("Mux error");
    expect(await getStreamState(streamId)).toBe("error");
  });
});
```

## Best Practices

1. **Always validate state transitions** before applying them
2. **Log all state changes** for debugging and analytics
3. **Implement timeouts** for transitional states
4. **Monitor state consistency** between DB and external services
5. **Provide clear error messages** in error states
6. **Clean up resources** when entering error or stopped states
7. **Notify relevant parties** of state changes (owners, viewers)
8. **Test all transition paths** including error scenarios

## References

- Issue #1818: Stream session validation
- [Mux Live Stream States](https://docs.mux.com/guides/video/monitor-your-live-stream)
- State Machine Pattern: [Wikipedia](https://en.wikipedia.org/wiki/Finite-state_machine)

## Support

For questions about stream lifecycle management, contact the development team or open an issue.
