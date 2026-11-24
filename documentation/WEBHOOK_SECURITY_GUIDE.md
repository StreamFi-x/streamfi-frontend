# Webhook Security Guide

## Overview

This guide covers security best practices for webhook implementation in StreamFi, addressing common vulnerabilities and providing implementation patterns for secure webhook handling.

## Related Issues

This documentation supports the security requirements discussed in issues #1814 and related webhook security concerns.

## Webhook Signature Verification

### Requirements

All production webhooks MUST implement:

1. **Signature Verification**: Validate HMAC signatures on all incoming webhook requests
2. **Timestamp Validation**: Reject requests with timestamps outside acceptable window (default: 5 minutes)
3. **Replay Protection**: Prevent duplicate processing of the same webhook event
4. **Fail-Closed**: Reject requests when signature secret is not configured in production

### Implementation Pattern

```typescript
// Example webhook validation flow
async function validateWebhook(
  request: Request,
  secret: string | undefined
): Promise<{ valid: boolean; error?: string }> {
  // 1. Fail closed in production if secret not configured
  if (process.env.NODE_ENV === "production" && !secret) {
    return {
      valid: false,
      error: "Webhook signature secret is not configured",
    };
  }

  // 2. Extract signature and timestamp from headers
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (!signature || !timestamp) {
    return { valid: false, error: "Missing signature or timestamp" };
  }

  // 3. Validate timestamp is within acceptable window
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);
  const maxAge = 300; // 5 minutes

  if (Math.abs(now - requestTime) > maxAge) {
    return { valid: false, error: "Request timestamp too old" };
  }

  // 4. Verify HMAC signature
  const body = await request.text();
  const expectedSignature = await computeHMAC(secret!, timestamp + body);

  if (signature !== expectedSignature) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}
```

## Mux Webhook Security

### Configuration

Mux webhooks require the `MUX_WEBHOOK_SECRET` environment variable:

```bash
# .env.local
MUX_WEBHOOK_SECRET=your_mux_webhook_signing_secret
```

### Production Requirements

- **MUST** set `MUX_WEBHOOK_SECRET` in production environment
- **MUST** validate signatures on all incoming Mux webhook events
- **SHOULD** implement retry logic for transient failures
- **SHOULD** log verification failures for security monitoring

### Error Handling

```typescript
// Production: Return 500 if signature verification fails
if (process.env.NODE_ENV === "production" && !process.env.MUX_WEBHOOK_SECRET) {
  return new Response(
    JSON.stringify({ error: "Webhook signature secret is not configured" }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
```

## Replay Attack Prevention

### Idempotency Keys

Webhooks should include idempotency keys to prevent duplicate processing:

```typescript
interface WebhookEvent {
  id: string; // Unique event ID
  type: string;
  timestamp: number;
  data: any;
}

// Store processed event IDs with TTL
async function isEventProcessed(eventId: string): Promise<boolean> {
  const key = `webhook:processed:${eventId}`;
  const exists = await redis.get(key);

  if (exists) {
    return true;
  }

  // Store with 24-hour TTL
  await redis.setex(key, 86400, "1");
  return false;
}
```

### Deduplication Strategy

1. **Check**: Verify event hasn't been processed
2. **Lock**: Acquire distributed lock for event ID
3. **Process**: Handle webhook event
4. **Record**: Mark event as processed
5. **Release**: Release lock

## Rate Limiting

Apply rate limits to webhook endpoints:

```typescript
const WEBHOOK_RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 100, // per IP
  skipSuccessfulRequests: false,
};
```

## Monitoring and Alerting

### Metrics to Track

- Signature verification failures (potential attack)
- Timestamp validation failures (clock skew or replay)
- Rate limit hits
- Processing latency
- Error rates by webhook type

### Alert Thresholds

- **Critical**: > 10% verification failures in 5 minutes
- **Warning**: > 5% timestamp validation failures
- **Info**: Rate limit exceeded for specific IP

## Testing

### Development Environment

Development and test environments may skip signature verification with explicit configuration:

```typescript
const SKIP_SIGNATURE_VERIFICATION =
  process.env.NODE_ENV !== "production" &&
  process.env.SKIP_WEBHOOK_VERIFICATION === "true";
```

### Test Webhook Payloads

```typescript
// Test with valid signature
const testPayload = {
  type: "video.live_stream.active",
  data: { id: "test-stream-123" },
};

const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = await computeHMAC(
  process.env.MUX_WEBHOOK_SECRET!,
  timestamp + JSON.stringify(testPayload)
);

await fetch("/api/webhooks/mux", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-webhook-signature": signature,
    "x-webhook-timestamp": timestamp,
  },
  body: JSON.stringify(testPayload),
});
```

## Security Checklist

- [ ] Webhook signature verification implemented
- [ ] Timestamp validation with 5-minute window
- [ ] Replay protection via idempotency
- [ ] Fail-closed behavior in production
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Test coverage for security scenarios
- [ ] Documentation updated

## References

- [Mux Webhook Security](https://docs.mux.com/guides/video/verify-webhook-signatures)
- [OWASP Webhook Security](https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html)
- Issue #1814: Webhook signature verification patterns
- Issue #1816: Mux webhook production configuration (if applicable)

## Support

For security concerns, contact: security@streamfi.app
