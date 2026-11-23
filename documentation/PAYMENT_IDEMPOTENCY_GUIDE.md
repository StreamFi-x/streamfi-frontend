# Payment Transaction Idempotency Guide

## Overview

This document describes the idempotency patterns and best practices for payment transactions in StreamFi, ensuring reliable payment processing without duplicates.

## Related Issues

This documentation addresses payment idempotency requirements from issue #1812.

## What is Idempotency?

**Idempotency** ensures that performing the same operation multiple times has the same effect as performing it once. For payments, this means:

- Retrying a failed payment request doesn't charge the user twice
- Network failures don't result in duplicate transactions
- Client retries are safe and predictable

## Idempotency Keys

### Format Requirements

Idempotency keys MUST:
- Be unique per intended transaction
- Be 16-64 characters long
- Contain only alphanumeric characters, hyphens, and underscores
- Be deterministic for the same logical operation

**Regex Pattern**: `/^[a-zA-Z0-9_-]{16,64}$/`

### Generation Strategies

#### Client-Generated Keys

```typescript
// Option 1: UUID-based
const idempotencyKey = `tx_${uuidv4()}`;

// Option 2: Composite key with user + timestamp + operation
const idempotencyKey = `payment_${userId}_${Date.now()}_${operationType}`;

// Option 3: Hash-based (for retry safety)
import crypto from "crypto";

function generateIdempotencyKey(userId: string, amount: string, recipientId: string): string {
  const payload = `${userId}:${amount}:${recipientId}:${Date.now()}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  return `tx_${hash.slice(0, 32)}`;
}
```

#### Server-Generated Keys

```typescript
// For server-initiated transactions (payouts, refunds)
async function generateServerIdempotencyKey(
  operation: string,
  entityId: string
): Promise<string> {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  return `${operation}_${entityId}_${timestamp}_${nonce}`;
}
```

## Implementation Pattern

### Request Handler

```typescript
interface IdempotentRequest {
  idempotencyKey: string;
  // ... other request fields
}

interface IdempotencyRecord {
  key: string;
  status: "processing" | "completed" | "failed";
  response?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

async function handleIdempotentPayment(
  request: IdempotentRequest
): Promise<Response> {
  const { idempotencyKey } = request;

  // 1. Check if request was already processed
  const existingRecord = await getIdempotencyRecord(idempotencyKey);

  if (existingRecord) {
    if (existingRecord.status === "processing") {
      // Request is currently being processed
      return new Response(
        JSON.stringify({ status: "processing", message: "Request is being processed" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    if (existingRecord.status === "completed") {
      // Return cached successful response
      return new Response(JSON.stringify(existingRecord.response), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Idempotent-Replayed": "true",
        },
      });
    }

    if (existingRecord.status === "failed") {
      // Return cached error response
      return new Response(
        JSON.stringify({ error: existingRecord.error }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Idempotent-Replayed": "true",
          },
        }
      );
    }
  }

  // 2. Create processing record (atomic operation)
  try {
    await createIdempotencyRecord({
      key: idempotencyKey,
      status: "processing",
      createdAt: new Date(),
    });
  } catch (error) {
    // Race condition: another request created the record
    return new Response(
      JSON.stringify({ status: "processing", message: "Request is being processed" }),
      { status: 409 }
    );
  }

  // 3. Process the payment
  try {
    const result = await processPayment(request);

    // 4. Mark as completed with result
    await updateIdempotencyRecord(idempotencyKey, {
      status: "completed",
      response: result,
      completedAt: new Date(),
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // 5. Mark as failed with error
    await updateIdempotencyRecord(idempotencyKey, {
      status: "failed",
      error: error.message,
      completedAt: new Date(),
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
```

## Storage Backend

### Redis Implementation

```typescript
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const IDEMPOTENCY_TTL = 86400; // 24 hours

async function getIdempotencyRecord(
  key: string
): Promise<IdempotencyRecord | null> {
  const data = await redis.get(`idempotency:${key}`);
  return data ? (JSON.parse(data as string) as IdempotencyRecord) : null;
}

async function createIdempotencyRecord(
  record: Omit<IdempotencyRecord, "completedAt">
): Promise<void> {
  const success = await redis.set(
    `idempotency:${record.key}`,
    JSON.stringify(record),
    {
      nx: true, // Only set if not exists (atomic)
      ex: IDEMPOTENCY_TTL,
    }
  );

  if (!success) {
    throw new Error("Idempotency key already exists");
  }
}

async function updateIdempotencyRecord(
  key: string,
  updates: Partial<IdempotencyRecord>
): Promise<void> {
  const existing = await getIdempotencyRecord(key);
  if (!existing) {
    throw new Error("Idempotency record not found");
  }

  const updated = { ...existing, ...updates };
  await redis.set(`idempotency:${key}`, JSON.stringify(updated), {
    ex: IDEMPOTENCY_TTL,
  });
}
```

### Database Implementation

```sql
CREATE TABLE idempotency_records (
  key VARCHAR(64) PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  response JSONB,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);
```

```typescript
async function createIdempotencyRecordDB(
  record: Omit<IdempotencyRecord, "completedAt">
): Promise<void> {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL * 1000);

  try {
    await db.query(
      `INSERT INTO idempotency_records (key, status, created_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [record.key, record.status, record.createdAt, expiresAt]
    );
  } catch (error) {
    if (error.code === "23505") {
      // Unique constraint violation
      throw new Error("Idempotency key already exists");
    }
    throw error;
  }
}
```

## Deduplication Configuration

### Window Settings

```typescript
const IDEMPOTENCY_CONFIG = {
  // How long to store idempotency records
  windowSeconds: 86400, // 24 hours
  
  // How often to clean up expired records
  cleanupIntervalSeconds: 3600, // 1 hour
  
  // Maximum records to keep in memory (Redis)
  maxStoredKeys: 100000,
  
  // Whether to allow retries for failed transactions
  allowRetryOnFailure: false,
};
```

### Cleanup Job

```typescript
async function cleanupExpiredIdempotencyRecords(): Promise<void> {
  const now = new Date();
  
  // Database cleanup
  await db.query(
    `DELETE FROM idempotency_records WHERE expires_at < $1`,
    [now]
  );
  
  // Redis cleanup (using scan to avoid blocking)
  let cursor = 0;
  
  do {
    const [newCursor, keys] = await redis.scan(cursor, {
      match: "idempotency:*",
      count: 100,
    });
    
    cursor = newCursor;
    
    for (const key of keys) {
      const record = await getIdempotencyRecord(key.replace("idempotency:", ""));
      if (record && isExpired(record)) {
        await redis.del(key);
      }
    }
  } while (cursor !== 0);
}

function isExpired(record: IdempotencyRecord): boolean {
  const expiresAt = new Date(record.createdAt.getTime() + IDEMPOTENCY_CONFIG.windowSeconds * 1000);
  return expiresAt < new Date();
}

// Schedule cleanup job (example using cron)
// 0 * * * * - Every hour
```

## API Integration

### Request Example

```typescript
// Client-side payment request
async function sendTip(
  recipientId: string,
  amount: string,
  currency: string
): Promise<PaymentResult> {
  const idempotencyKey = generateIdempotencyKey(
    currentUserId,
    amount,
    recipientId
  );

  const response = await fetch("/api/payments/tip", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      recipientId,
      amount,
      currency,
    }),
  });

  if (response.status === 409) {
    // Processing or already processed
    const data = await response.json();
    if (data.status === "processing") {
      // Poll or wait
      await sleep(1000);
      return sendTip(recipientId, amount, currency); // Retry with same key
    }
  }

  return await response.json();
}
```

### Server-side Handler

```typescript
// pages/api/payments/tip.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get("Idempotency-Key");

  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "Idempotency-Key header is required" },
      { status: 400 }
    );
  }

  // Validate key format
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "Invalid idempotency key format" },
      { status: 400 }
    );
  }

  const body = await request.json();

  return await handleIdempotentPayment({
    idempotencyKey,
    ...body,
  });
}
```

## Collision Handling

### Strategy

When an idempotency key collision occurs:

1. **Return existing result** if transaction completed successfully
2. **Return 409 Conflict** if transaction is still processing
3. **Allow retry** only if previous attempt failed (configurable)
4. **Log collision** for monitoring and fraud detection

```typescript
const COLLISION_STRATEGY = {
  // Return cached result for completed transactions
  returnExistingResult: true,
  
  // Log all collisions for analysis
  logCollision: true,
  
  // Allow retry if previous attempt failed
  allowRetryOnFailure: false,
  
  // Maximum processing time before considering stuck
  maxProcessingTimeMs: 60000, // 1 minute
};

async function handleCollision(
  idempotencyKey: string,
  existingRecord: IdempotencyRecord
): Promise<Response> {
  // Log collision event
  if (COLLISION_STRATEGY.logCollision) {
    await logEvent("idempotency_collision", {
      key: idempotencyKey,
      existingStatus: existingRecord.status,
      existingAge: Date.now() - existingRecord.createdAt.getTime(),
    });
  }

  // Check if stuck in processing
  if (existingRecord.status === "processing") {
    const age = Date.now() - existingRecord.createdAt.getTime();
    
    if (age > COLLISION_STRATEGY.maxProcessingTimeMs) {
      // Consider stuck, allow retry
      await updateIdempotencyRecord(idempotencyKey, {
        status: "failed",
        error: "Transaction timed out",
        completedAt: new Date(),
      });
      
      return new Response(
        JSON.stringify({ error: "Previous transaction timed out, please retry" }),
        { status: 408 }
      );
    }
  }

  // Return existing result
  return COLLISION_STRATEGY.returnExistingResult
    ? new Response(JSON.stringify(existingRecord.response), {
        status: 200,
        headers: { "Idempotent-Replayed": "true" },
      })
    : new Response(
        JSON.stringify({ error: "Duplicate request" }),
        { status: 409 }
      );
}
```

## Monitoring

### Key Metrics

```typescript
interface IdempotencyMetrics {
  // Collision rates
  collisionRate: number;           // Percentage of requests with existing keys
  replayedSuccessRate: number;     // Successfully returned cached results
  
  // Processing states
  processingCount: number;         // Currently processing
  completedCount: number;          // Successfully completed
  failedCount: number;             // Failed transactions
  
  // Performance
  averageProcessingTime: number;   // Average time to complete
  stuckCount: number;              // Stuck in processing state
  
  // Storage
  totalKeysStored: number;         // Total keys in storage
  cleanupRate: number;             // Keys cleaned per hour
}
```

### Alerts

```typescript
// Alert if collision rate exceeds threshold
if (metrics.collisionRate > 0.1) {
  // More than 10% collisions
  await alertTeam("High idempotency collision rate", metrics);
}

// Alert if many stuck transactions
if (metrics.stuckCount > 10) {
  await alertTeam("Multiple transactions stuck in processing", metrics);
}
```

## Testing

### Unit Tests

```typescript
describe("Idempotency key validation", () => {
  it("validates correct key format", () => {
    const validKeys = [
      "tx_abc123def456ghi7",
      "payment-2024-11-20-user123",
      "idempotency_key_example_12345678",
    ];

    validKeys.forEach(key => {
      expect(key).toMatch(/^[a-zA-Z0-9_-]{16,64}$/);
    });
  });

  it("rejects invalid key formats", () => {
    const invalidKeys = [
      "short",
      "a".repeat(65),
      "has spaces",
      "has@special#chars",
    ];

    invalidKeys.forEach(key => {
      expect(key).not.toMatch(/^[a-zA-Z0-9_-]{16,64}$/);
    });
  });
});
```

### Integration Tests

```typescript
describe("Payment idempotency", () => {
  it("returns same result for duplicate requests", async () => {
    const idempotencyKey = "test_payment_123";
    
    const request = {
      idempotencyKey,
      recipientId: "user-456",
      amount: "10.00",
      currency: "USD",
    };

    // First request
    const result1 = await handleIdempotentPayment(request);
    expect(result1.status).toBe(200);

    // Duplicate request
    const result2 = await handleIdempotentPayment(request);
    expect(result2.status).toBe(200);
    expect(result2.headers.get("Idempotent-Replayed")).toBe("true");
    
    // Verify only one payment was processed
    const payments = await getPaymentsByKey(idempotencyKey);
    expect(payments.length).toBe(1);
  });

  it("prevents concurrent processing of same key", async () => {
    const idempotencyKey = "test_concurrent_123";
    
    const request = {
      idempotencyKey,
      recipientId: "user-789",
      amount: "20.00",
      currency: "USD",
    };

    // Send two concurrent requests
    const [result1, result2] = await Promise.all([
      handleIdempotentPayment(request),
      handleIdempotentPayment(request),
    ]);

    // One succeeds, one returns 409
    const statuses = [result1.status, result2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
```

## Best Practices

1. **Always require idempotency keys** for payment operations
2. **Use client-generated keys** for better retry semantics
3. **Store keys for at least 24 hours** to handle delayed retries
4. **Return cached results** instead of processing duplicates
5. **Monitor collision rates** for potential issues
6. **Implement cleanup jobs** to prevent unbounded storage growth
7. **Log all collisions** for fraud detection
8. **Test concurrent scenarios** thoroughly

## References

- Issue #1812: Payment transaction idempotency
- [Stripe Idempotency Guide](https://stripe.com/docs/api/idempotent_requests)
- [RFC 5789: PATCH Method for HTTP](https://tools.ietf.org/html/rfc5789)
- [Idempotency Patterns](https://www.nginx.com/blog/microservices-reference-architecture-idempotency/)

## Support

For payment-related questions, contact the payments team or open an issue.
