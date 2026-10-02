# Distributed Tracing Implementation

## Overview

This codebase implements **correlation-ID-based distributed tracing** across all service boundaries:
- Next.js API route handlers
- Neon Postgres database queries
- Stellar/Horizon blockchain API
- Mux video streaming API

All requests are tagged with a unique `x-request-id` (trace ID) that flows through every service hop, enabling end-to-end request correlation in logs.

## Architecture Decision: Correlation ID vs OpenTelemetry

**Chosen: Lightweight Correlation ID scheme**

**Rationale:**
- **Simpler to adopt**: Minimal instrumentation footprint; no backend tracing platform required
- **Lower overhead**: No span collection/export; just headers + structured logs
- **Fits current stack**: Works with existing console logging; no new dependencies
- **Production-ready for debugging**: Engineers can grep logs by trace ID to follow a single request across all services

**Trade-off:** No automatic span timing or distributed execution visualization (available with OpenTelemetry), but the primary goal — correlating scattered log lines — is fully solved.

## Components

### 1. Trace Context Management (`lib/tracing/trace-context.ts`)

**Purpose:** AsyncLocalStorage-based request-scoped context that flows through async call chains.

**Key Exports:**
- `createTraceContext(traceId?, parentSpanId?)` — Create a new trace context or extract from incoming headers
- `withTraceContextAsync(context, fn)` — Execute function within trace context
- `getTraceHeaders()` — Get propagation headers for outbound requests
- `formatTraceContext()` — Get trace context object for logging

**Data Structure:**
```typescript
interface TraceContext {
  traceId: string;              // e.g., "trace-550e8400-e29b-41d4-a716-446655440000"
  spanId: string;               // e.g., "span-6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  parentSpanId?: string;        // For nested operations
  timestamp: number;            // Request start time (ms)
}
```

**How It Works:**
- Each incoming request creates a `TraceContext` in the middleware
- `AsyncLocalStorage` ensures all nested async calls in that request see the same context
- No explicit passing required — functions call `getCurrentTraceContext()` to access it

### 2. Structured Logger (`lib/tracing/logger.ts`)

**Purpose:** JSON-based structured logging that automatically injects trace context into every log line.

**Interface:**
```typescript
logger.info(message, data?);
logger.warn(message, data?);
logger.error(message, errorOrString?);
logger.debug(message, data?);
```

**Output Format:**
```json
{
  "timestamp": "2026-09-24T14:23:45.123Z",
  "level": "info",
  "message": "Tip send request received",
  "traceId": "trace-550e8400-e29b-41d4-a716-446655440000",
  "spanId": "span-6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "endpoint": "POST /api/tips/send",
  "userId": "user_12345"
}
```

All log lines from a single request automatically include the same `traceId`, making them queryable and grouped.

### 3. Global Middleware (`middleware.ts`)

**Purpose:** Generate or extract trace ID for every incoming request; propagate through response headers.

**Flow:**
1. Extract incoming `x-request-id` / `x-trace-id` from request headers (or generate new one)
2. Create trace context from extracted/generated ID
3. Run all downstream logic within that context
4. Attach trace ID to all response headers

**Result:** Every request has a trace ID from entry point; all downstream operations inherit it via AsyncLocalStorage.

### 4. API Route Wrapper (`lib/tracing/api-route-wrapper.ts`)

**Purpose:** Higher-order function that wraps individual route handlers with automatic tracing.

**Usage:**
```typescript
const handler = async (req: NextRequest) => {
  // Your route logic here
};

export const POST = withTracing(handler);
```

**Provides:**
- Automatic trace context setup per route
- Request start/end logging with duration
- Error logging with full error context
- Automatic trace ID in response headers

### 5. Outbound Request Tracer (`lib/tracing/fetch-tracer.ts`)

**Purpose:** Wrapper around `fetch()` that automatically propagates trace headers to external APIs.

**Usage:**
```typescript
import { tracedFetch } from '@/lib/tracing/fetch-tracer';

const data = await tracedFetch(muxApiUrl, {
  method: 'POST',
  body: JSON.stringify(payload),
  serviceName: 'mux',
  operation: 'createStream',
});
```

**Provides:**
- Automatic trace header injection (`x-request-id`, `x-trace-id`, `x-span-id`)
- Structured logging of outbound request (service, operation, duration, status)
- Error tracking with trace context

### 6. Database Query Tracer (`lib/tracing/db-tracer.ts`)

**Purpose:** Inject trace context into SQL queries as comments (for database-level debugging).

**Usage:**
```typescript
import { addTraceComment, logDbQuery } from '@/lib/tracing/db-tracer';

const query = addTraceComment(`SELECT * FROM users WHERE id = $1`);
// Query becomes: "SELECT * FROM users WHERE id = $1 /* trace_id=... span_id=... */"

// Log the operation
logDbQuery('SELECT user', query);
```

**Provides:**
- SQL comment injection for DB query analysis
- Structured logging of database operations
- Error tracking for failed queries

## End-to-End Example: Sending a Tip

Complete trace through the system for `POST /api/tips/send`:

### Request Flow with Trace IDs

```
1. CLIENT → NEXT.JS
   Request Headers: (none, or contains x-request-id from client)
   Middleware generates: traceId = "trace-550e8400-..."
   ↓

2. MIDDLEWARE
   Establishes AsyncLocalStorage context with traceId
   Calls next handler within context
   Response headers: x-request-id: trace-550e8400-...
   ↓

3. ROUTE HANDLER: POST /api/tips/send
   [withTracing wrapper]
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "Tip send request received"}
   ↓

4. AUTH: verifySession()
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "Session verified"}
   ↓

5. DATABASE: SELECT stellar_public_key FROM users WHERE id = $1
   Query executed: "SELECT stellar_public_key FROM users WHERE id = $1 /* trace_id=trace-550e8400-... */"
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "User wallet retrieved from database"}
   ↓

6. BLOCKCHAIN: buildTipTransaction()
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "Building Stellar transaction"}
   Makes Horizon API call to horizon.stellar.org
   ↓

7. DATABASE: INSERT INTO tips (...)
   Query executed: "INSERT INTO tips ... /* trace_id=trace-550e8400-... */"
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "Tip recorded in database"}
   ↓

8. BLOCKCHAIN: submitTransaction()
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "Submitting transaction to Stellar"}
   Makes Horizon API call to submit transaction
   ↓

9. DATABASE: UPDATE tips SET status = 'confirmed' ...
   Query executed: "UPDATE tips ... /* trace_id=trace-550e8400-... */"
   Logs: {"timestamp": ..., "traceId": "trace-550e8400-...", "message": "Tip status updated to confirmed"}
   ↓

10. ROUTE HANDLER RESPONSE
    {"success": true, "transactionHash": "...", "requestId": "trace-550e8400-..."}
    Response headers: x-request-id: trace-550e8400-...
```

### Debugging with Trace IDs

To debug why a specific tip was slow or failed:

**Step 1:** Get the trace ID from the response or client request
```
requestId: "trace-550e8400-e29b-41d4-a716-446655440000"
```

**Step 2:** Search all logs for that trace ID
```bash
# Next.js application logs
grep "trace-550e8400-e29b-41d4-a716-446655440000" /var/log/app.log | jq .

# Should show all operations in order:
# - Request started
# - Session verified
# - Database query (wallet lookup)
# - Stellar transaction built
# - Stellar transaction submitted
# - Response sent
# Total time visible from timestamps
```

**Step 3:** Cross-reference with external services
```bash
# Mux logs (if integrated)
curl "https://api.mux.com/logs?trace_id=trace-550e8400-e29b-41d4-a716-446655440000"

# Stellar logs (if available)
curl "https://horizon.stellar.org/logs?trace_id=trace-550e8400-e29b-41d4-a716-446655440000"

# Postgres query logs (if enabled)
SELECT * FROM pg_stat_statements WHERE query LIKE '%trace_id=trace-550e8400%';
```

**Result:** All log lines from that request are tagged with the same ID, making it trivial to follow the entire request lifecycle and pinpoint where time was spent.

## Files Changed

### New Files Created
- `lib/tracing/trace-context.ts` — Core trace context management
- `lib/tracing/logger.ts` — Structured logging with trace injection
- `lib/tracing/api-route-wrapper.ts` — Route handler wrapper
- `lib/tracing/fetch-tracer.ts` — Outbound request tracer
- `lib/tracing/db-tracer.ts` — Database query tracer
- `middleware.ts` — Global request middleware
- `app/api/tips/send/route.ts` — Example end-to-end traced endpoint

### Modified Files
- `_middleware.ts` → Deprecated (functionality moved to `middleware.ts`)
- `lib/mux/server.ts` — Updated to use structured logger
- `lib/stellar/horizon.ts` — Updated to use structured logger
- `lib/stellar/payments.ts` — Updated to use structured logger

## Integration Checklist

To add tracing to additional endpoints or services:

### For Route Handlers
```typescript
import { withTracing } from '@/lib/tracing/api-route-wrapper';

const handler = async (req: NextRequest) => {
  // Your logic here
};

export const POST = withTracing(handler);
```

### For External API Calls
```typescript
import { tracedFetch } from '@/lib/tracing/fetch-tracer';

const result = await tracedFetch(url, {
  method: 'POST',
  body: JSON.stringify(payload),
  serviceName: 'external-service',
  operation: 'operationName',
});
```

### For Database Queries
```typescript
import { logger } from '@/lib/tracing/logger';
import { addTraceComment, logDbQuery } from '@/lib/tracing/db-tracer';

const query = addTraceComment(`SELECT * FROM table WHERE id = $1`);
try {
  const result = await sql`SELECT * FROM table WHERE id = ${id}`;
  logDbQuery('SELECT record', query);
} catch (error) {
  logDbQuery('SELECT record', query, error);
}
```

### For Structured Logging
```typescript
import { logger } from '@/lib/tracing/logger';

logger.info('Operation successful', {
  userId: user.id,
  duration: Date.now() - startTime,
});

logger.error('Operation failed', error);
```

## Log Aggregation / Export

Current implementation logs to stdout in JSON format. To integrate with log aggregation platforms:

### Datadog
```bash
# Kubernetes pod annotation
datadog.ad.io/logs: |
  [
    {
      "service": "streamfi-frontend",
      "source": "nodejs",
      "json_parsing": true,
      "trace_id": "traceId"
    }
  ]
```

### Honeycomb
```typescript
// Add to logger.ts to send traces
fetch('https://api.honeycomb.io/v1/traces', {
  method: 'POST',
  headers: { 'X-Honeycomb-Team': process.env.HONEYCOMB_KEY },
  body: JSON.stringify({ traceId, logs: [...] }),
});
```

### Elasticsearch / ELK Stack
```bash
# Logstash configuration to parse JSON logs
input {
  stdin { codec => json }
}
filter {
  if [traceId] {
    mutate { add_field => { "trace_id" => "%{traceId}" } }
  }
}
output {
  elasticsearch { hosts => ["localhost:9200"] }
}
```

## Testing

To verify tracing is working end-to-end:

1. **Call the traced endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/tips/send \
     -H "Content-Type: application/json" \
     -d '{"destinationPublicKey": "G...", "amount": "10.0"}'
   ```

2. **Capture the `x-request-id` from response headers:**
   ```
   x-request-id: trace-550e8400-e29b-41d4-a716-446655440000
   ```

3. **Search application logs for that trace ID:**
   ```bash
   grep "trace-550e8400-e29b-41d4-a716-446655440000" /var/log/app.log | jq . | head -20
   ```

4. **Verify the trace contains:**
   - Request start log
   - Session verification logs
   - Database operation logs (with SQL trace comments)
   - Stellar API call logs
   - Response completion log
   - All with matching traceId

## Future Enhancements

1. **OpenTelemetry Migration:** Wrap correlation IDs with OpenTelemetry spans for timing breakdowns
2. **Trace Backend:** Send traces to Jaeger/Honeycomb/Datadog for visualization
3. **Automatic Database Tracing:** Hook `@vercel/postgres` to auto-inject trace context
4. **Mux API Headers:** Configure Mux SDK to accept custom headers for trace propagation
5. **Performance Metrics:** Add p95/p99 latency tracking per service hop
