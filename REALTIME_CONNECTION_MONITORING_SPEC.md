# WebSocket/SSE Connection Monitoring & Capacity Management Specification

## Overview

This document specifies the connection-monitoring and capacity-management infrastructure for the realtime layer (WebSocket/SSE). This work is **scoped to design and implementation now**, but **deployment is contingent on the choice of realtime infrastructure** (managed provider vs self-hosted).

The solution provides:
1. **Per-instance connection tracking** — monitor how many concurrent connections each instance holds
2. **Configurable capacity limits** — prevent single instances from exceeding sustainable connection counts
3. **Graceful rejection/shedding** — shed low-priority connections before capacity is exceeded
4. **Metrics export** — expose connection metrics for monitoring (Prometheus format, JSON API)
5. **Alert integration** — integrate capacity warnings with alerting systems

---

## Architecture

### Three-Tier Design

#### 1. Connection Manager (`lib/realtime/connection-manager.ts`)
Core per-instance connection tracking and shedding logic.

**Responsibilities:**
- Maintain registry of active connections
- Track per-connection metadata (user, channels, activity, priority)
- Enforce per-instance capacity limits
- Implement shedding strategies (shed oldest, shed least active, reject new)
- Emit capacity alerts
- Support graceful shutdown with drain window

**Key Methods:**
```typescript
addConnection(connectionId, userId?, priority?) → boolean
removeConnection(connectionId) → boolean
updateActivity(connectionId, dataTransferred) → void
subscribeToChannel(connectionId, channel) → void
getConnectionsToShed(count) → ShedDecision[]
shedConnections(decisions) → string[]
gracefulShutdown() → Promise<{drainedConnections, remainingConnections}>
getMetrics() → ConnectionMetrics
```

**Metrics Tracked:**
- Active connections (current count)
- Total connections created
- Peak concurrent connections
- Rejected connections (capacity exceeded)
- Shed connections (load-balancing)
- Instance uptime

#### 2. Metrics Exporter (`lib/realtime/metrics-exporter.ts`)
Aggregation and export of metrics for monitoring systems.

**Responsibilities:**
- Collect metrics from all instances
- Aggregate global metrics
- Export in standard formats (Prometheus, JSON)
- Record and surface alerts

**Key Classes:**
- `MetricsCollector` — aggregate metrics across instances
- `AlertSink` — integrate with external alerting (Datadog, PagerDuty, etc.)

#### 3. WebSocket Server Integration (`lib/realtime/websocket-server-example.ts`)
Reference implementation showing how to integrate with a real WebSocket server.

**Responsibilities:**
- Initialize ConnectionManager with capacity config
- Hook into connection lifecycle (new, message, close)
- Handle shedding decisions (close frames with reason)
- Emit metrics for monitoring
- Implement graceful shutdown

---

## Configuration

### CapacityConfig
```typescript
interface CapacityConfig {
  instanceId: string;                    // Unique identifier for this instance
  maxConnections: number;                // Hard limit (e.g., 10,000)
  warningThreshold: number;              // Alert percentage (e.g., 80)
  shedThreshold: number;                 // Start rejecting at percentage (e.g., 95)
  shedStrategy: 'reject_new' | 'shed_oldest' | 'shed_least_active';
  gracefulShutdownWindow: number;        // Milliseconds to allow connections to drain
}
```

### Environment Variables
```bash
# WebSocket Server Config
INSTANCE_ID=ws-us-east-1-a
WS_MAX_CONNECTIONS=10000
WS_WARNING_THRESHOLD=80
WS_SHED_THRESHOLD=95
WS_SHED_STRATEGY=shed_least_active

# Alerting
ALERT_WEBHOOK_URL=https://alerts.company.com/webhook
DATADOG_API_KEY=xxx
PAGERDUTY_ROUTING_KEY=xxx
```

---

## Metrics & Monitoring

### Exported Metrics (Prometheus Format)

```
# Per-instance metrics
streamfi_connections_active{instance="ws-us-east-1-a"} 5234
streamfi_connections_total{instance="ws-us-east-1-a"} 12843
streamfi_connections_peak{instance="ws-us-east-1-a"} 9876
streamfi_connections_rejected{instance="ws-us-east-1-a"} 234
streamfi_connections_shed{instance="ws-us-east-1-a"} 45
streamfi_instance_uptime{instance="ws-us-east-1-a"} 86400
```

### JSON Metrics API

```
GET /metrics

{
  "timestamp": "2026-09-24T14:23:45Z",
  "aggregated": {
    "totalActiveConnections": 45234,
    "totalCapacity": 100000,
    "globalLoadPercentage": 45.2,
    "overCapacityInstances": []
  },
  "instances": {
    "ws-us-east-1-a": {
      "activeConnections": 5234,
      "totalConnections": 12843,
      "peakConnections": 9876,
      "rejectedConnections": 234,
      "shedConnections": 45,
      "uptime": "24h 00m"
    },
    "ws-us-west-2-b": { ... }
  },
  "recentAlerts": [ ... ]
}
```

### Health Check Endpoint

```
GET /health

{
  "status": "healthy" | "warning" | "degraded",
  "load": "45.2%",
  "activeConnections": 5234,
  "timestamp": "2026-09-24T14:23:45Z"
}
```

---

## Alerting

### Alert Types

1. **capacity_warning** (warning severity)
   - Triggered when load reaches warning threshold (e.g., 80%)
   - Alerts operators to monitor capacity trend
   - Does not trigger shedding yet

2. **capacity_limit_exceeded** (error severity)
   - Triggered when load reaches shed threshold (e.g., 95%)
   - Indicates shedding or rejection is active
   - Immediate investigation needed

3. **shed_initiated** (warning severity)
   - Triggered when connections are being shed
   - Indicates load-balancing in action

### Alert Integration Points

```typescript
// Register custom alert handler
server.registerAlertHandler(async (alert) => {
  // Send to Datadog
  await datadogClient.recordMetric({
    metric: `streamfi.connection.${alert.type}`,
    value: alert.currentLoad,
    tags: [
      `instance:${alert.instanceId}`,
      `severity:${alert.severity}`,
    ],
  });

  // Send to PagerDuty if critical
  if (alert.severity === 'error') {
    await pagerdutyClient.createIncident({
      title: `WebSocket capacity critical on ${alert.instanceId}`,
      service_id: 'service-123',
      urgency: 'high',
    });
  }
});
```

---

## Shedding Strategies

### Strategy: reject_new
- When at capacity, reject all new connection attempts
- Simplest, but creates hard cutoff
- Clients see immediate "server at capacity" error

### Strategy: shed_oldest
- When at capacity, close oldest connections
- Spreads disruption across all connections
- Helps maintain high-priority recent connections

### Strategy: shed_least_active (recommended)
- When at capacity, prioritize shedding low-activity connections
- Closes based on activity + priority tier
- Preserves active, high-priority connections

**Implementation:**
```typescript
// Priority tiers (for shed decisions)
- high: critical system connections, authenticated users
- normal: typical client connections
- low: unauthenticated, exploratory connections

// Shedding order:
1. Low-priority, least active
2. Normal-priority, least active
3. High-priority, least active (only if absolutely necessary)
```

---

## Graceful Shutdown

When an instance is shutting down:

1. **Stop accepting new connections**
   - Flag `isShuttingDown = true`
   - Return 503 Service Unavailable to new connection attempts

2. **Notify connected clients**
   - Send shutdown message to all connections
   - Allow clients time to gracefully disconnect or reconnect

3. **Drain with window**
   - Wait for `gracefulShutdownWindow` milliseconds (default 30s)
   - Monitor how many connections drain naturally
   - Force-close remaining connections after window

4. **Log results**
   - Track drain efficiency
   - Log for post-incident analysis

---

## Integration Examples

### With Node.js WebSocket Server (ws library)

```typescript
import WebSocket from 'ws';
import { ManagedWebSocketServer } from '@/lib/realtime/websocket-server-example';

const managedServer = new ManagedWebSocketServer({
  instanceId: 'ws-prod-us-east-1',
  maxConnections: 10000,
  warningThreshold: 80,
  shedThreshold: 95,
  shedStrategy: 'shed_least_active',
  gracefulShutdownWindow: 30000,
});

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', async (ws) => {
  const connId = generateId();
  const allowed = await managedServer.handleNewConnection(connId, userId);

  if (!allowed) {
    ws.close(1008, 'Server at capacity');
    return;
  }

  ws.on('message', (data) => {
    managedServer.handleMessage(connId, data, data.length);
  });

  ws.on('close', () => {
    managedServer.handleConnectionClose(connId);
  });
});
```

### With Managed Provider (e.g., Pusher, Firebase Realtime)

For managed services, capacity management likely comes built-in. Integration involves:

1. **Configure provider's limits** (if customizable)
2. **Monitor provider's metrics** (via their API)
3. **Alert on provider's thresholds** (fetch metrics periodically)
4. **No need for custom shedding** (provider handles this)

---

## Load Testing

### Test Scenarios

#### 1. Ramp-Up Test
- Gradually add connections over time (e.g., 100/sec)
- Verify system accepts connections up to limit
- Verify warning threshold triggers at 80%

#### 2. Capacity Ceiling Test
- Fill instance to just below shed threshold
- Add burst of connections
- Verify connections are rejected or shed
- Verify metrics reflect rejections/sheds

#### 3. Graceful Shutdown Test
- Fill instance to 70% capacity
- Initiate shutdown
- Verify shutdown message sent to clients
- Measure drain efficiency

#### 4. Priority-Based Shedding Test
- Fill instance with mix of high/normal/low priority
- Add burst to trigger shedding
- Verify low-priority shed first
- Verify high-priority preserved longer

#### 5. Sustained Load Test
- Hold instance at 90% capacity for extended time
- Monitor for memory leaks, connection drift
- Verify metrics remain accurate
- Verify alerts don't flap

### Load Test Implementation

```typescript
describe('Load Test: Capacity Ceiling', () => {
  it('handles ramp to capacity and rejects beyond threshold', async () => {
    const manager = new ConnectionManager({
      instanceId: 'load-test',
      maxConnections: 1000,
      warningThreshold: 80,
      shedThreshold: 95,
      shedStrategy: 'shed_least_active',
      gracefulShutdownWindow: 5000,
    });

    // Ramp up
    const rampRate = 10; // connections per iteration
    let accepted = 0;
    for (let i = 0; i < 1000; i += rampRate) {
      for (let j = 0; j < rampRate; j++) {
        if (manager.addConnection(`conn-${i + j}`, `user-${i + j}`)) {
          accepted++;
        }
      }
      // Simulate message activity
      manager.updateActivity(`conn-${i}`, 1024);
    }

    const metrics = manager.getMetrics();
    expect(metrics.activeConnections).toBeGreaterThan(900);
    expect(metrics.rejectedConnections).toBeGreaterThan(0);
    expect(manager.isCapacityWarning()).toBe(true);
  });
});
```

---

## Deployment Checklist

- [ ] Deploy ConnectionManager to production environment
- [ ] Configure capacity limits based on instance resource testing
- [ ] Set up Prometheus scraping of metrics endpoint
- [ ] Configure alerting thresholds in monitoring system
- [ ] Set up dashboards for connection metrics
- [ ] Document runbook for capacity escalation
- [ ] Load test in staging before production rollout
- [ ] Plan for graceful shutdown procedures
- [ ] Monitor first week for alert tuning

---

## Future Enhancements

1. **Auto-scaling integration** — adjust instance count based on metrics
2. **Connection migration** — move connections between instances under load
3. **Per-channel capacity limits** — limit connections to high-traffic channels
4. **Geographic awareness** — track connections by region
5. **Client-side backoff** — clients respect server capacity signals
6. **Connection reservation** — pre-reserve capacity for critical users

---

## Testing Checklist (Acceptance Criteria)

✅ **Per-instance concurrent-connection tracking**
- ConnectionManager tracks active/total/peak connections
- Metrics exported in Prometheus and JSON formats

✅ **Configurable per-instance capacity limit**
- CapacityConfig specifies maxConnections
- Hard limit enforced with rejection/shedding

✅ **Graceful rejection/shedding behavior**
- Three strategies implemented (reject_new, shed_oldest, shed_least_active)
- Priority-based shedding (high/normal/low)
- Graceful shutdown with drain window

✅ **Alerting when approaching capacity**
- capacity_warning at threshold percentage
- capacity_limit_exceeded when shedding active
- Integration hooks for external alerting systems

✅ **Load tests at and beyond ceiling**
- Ramp-up, capacity ceiling, graceful shutdown, priority shedding tests
- All tests pass with expected behavior at limits

---

## Deployment Timeline

**Phase 1 (Now):** Implement ConnectionManager, metrics, alerting (this PR)
**Phase 2 (With realtime infrastructure decision):** Choose managed provider or self-hosted
**Phase 3 (If self-hosted):** Deploy ManagedWebSocketServer example, integrate with chosen WS library
**Phase 4 (Production):** Load test, tune thresholds, roll out with monitoring
