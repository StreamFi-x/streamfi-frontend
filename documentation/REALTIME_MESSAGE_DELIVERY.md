# Real-time Message Delivery Architecture

## Overview

This document describes the architecture and guarantees for real-time message delivery in StreamFi, covering message ordering, deduplication, and delivery semantics.

## Related Issues

This documentation addresses requirements from issue #1815 and related real-time messaging concerns.

## Message Delivery Guarantees

### Ordering Guarantees

StreamFi provides **per-channel ordering** for real-time messages:

- Messages within the same channel are delivered in sequence number order
- Sequence numbers are monotonically increasing per channel
- Cross-channel ordering is not guaranteed

### Delivery Semantics

**At-least-once delivery**: Messages may be delivered more than once due to:
- Network retries
- Connection recovery
- Server-side replication

Clients MUST implement deduplication using message sequence numbers.

## Message Structure

### Required Fields

```typescript
interface RealtimeMessage {
  channelId: string;      // Channel identifier (e.g., "stream:123:chat")
  type: string;           // Message type (e.g., "chat:message", "presence:join")
  payload: any;           // Message-specific data
  timestamp: number;      // Unix timestamp in milliseconds
}
```

### Optional Fields

```typescript
interface ExtendedRealtimeMessage extends RealtimeMessage {
  seq?: number;           // Monotonic sequence number per channel
  userId?: string;        // Sender user ID (if authenticated)
  metadata?: {
    ip?: string;          // Sender IP (server-side only)
    userAgent?: string;   // Client user agent
    [key: string]: any;   // Additional metadata
  };
}
```

## Message Ordering

### Sequence Numbers

Sequence numbers ensure total ordering within a channel:

```typescript
// Server-side sequence generation
let channelSequence = 0;

async function publishMessage(
  channelId: string,
  type: string,
  payload: any
): Promise<RealtimeMessage & { seq: number }> {
  const message = {
    channelId,
    type,
    payload,
    timestamp: Date.now(),
    seq: ++channelSequence, // Monotonic increment
  };

  await broadcastToChannel(channelId, message);
  return message;
}
```

### Timestamp Consistency

- All timestamps use Unix milliseconds (UTC)
- Server-generated timestamps prevent clock skew issues
- Client timestamps should NOT be trusted for ordering

## Client-Side Deduplication

### Implementation Pattern

```typescript
class MessageDeduplicator {
  private processedSeq = new Map<string, number>(); // channelId -> highest seq
  private seenMessages = new Set<string>(); // message IDs for fallback

  shouldProcess(message: ExtendedRealtimeMessage): boolean {
    // Primary: Use sequence number if available
    if (message.seq !== undefined) {
      const lastSeq = this.processedSeq.get(message.channelId) ?? 0;
      
      if (message.seq <= lastSeq) {
        return false; // Already processed
      }
      
      this.processedSeq.set(message.channelId, message.seq);
      return true;
    }

    // Fallback: Use message ID
    const msgId = `${message.channelId}:${message.timestamp}:${message.type}`;
    
    if (this.seenMessages.has(msgId)) {
      return false;
    }
    
    this.seenMessages.add(msgId);
    
    // Cleanup old entries (keep last 1000)
    if (this.seenMessages.size > 1000) {
      const oldestEntries = Array.from(this.seenMessages).slice(0, 100);
      oldestEntries.forEach(id => this.seenMessages.delete(id));
    }
    
    return true;
  }
}
```

## Channel Naming Convention

### Format

```
{resource}:{resourceId}:{scope}
```

### Examples

- `stream:abc123:chat` - Public chat for stream abc123
- `stream:abc123:presence` - Presence updates for stream abc123
- `stream:abc123:tips` - Tip notifications for stream abc123
- `user:xyz789:notifications` - Private notifications for user xyz789
- `creator:xyz789:analytics` - Private analytics for creator xyz789

### Access Control

Channel access is controlled via scoped tokens:

```typescript
// Mint token with specific channel access
const token = mintRealtimeToken([
  "stream:abc123:chat",
  "stream:abc123:presence",
  "stream:abc123:tips",
]);

// Verify token allows requested channels
const result = verifyRealtimeToken(token, ["stream:abc123:chat"]);

if (!result.ok) {
  throw new Error("Unauthorized channel access");
}
```

## Message Types

### Standard Message Types

#### Chat Messages
```typescript
{
  type: "chat:message",
  payload: {
    text: string;
    userId: string;
    username: string;
    badges?: string[];
  }
}
```

#### Presence Updates
```typescript
{
  type: "presence:join" | "presence:leave",
  payload: {
    userId: string;
    username: string;
  }
}
```

#### Tip Notifications
```typescript
{
  type: "tip:received",
  payload: {
    amount: string;
    currency: string;
    fromUserId?: string;
    message?: string;
  }
}
```

#### System Notifications
```typescript
{
  type: "system:notification",
  payload: {
    level: "info" | "warning" | "error";
    message: string;
    actionUrl?: string;
  }
}
```

## Performance Considerations

### Message Batching

For high-throughput channels, consider batching:

```typescript
interface MessageBatch {
  channelId: string;
  messages: RealtimeMessage[];
  startSeq: number;
  endSeq: number;
}
```

### Connection Recovery

On reconnection, clients should:

1. Reconnect to channel with last received sequence number
2. Request missed messages from server
3. Resume normal message flow

```typescript
async function reconnectChannel(
  channelId: string,
  lastSeq: number
): Promise<RealtimeMessage[]> {
  const missedMessages = await fetchMissedMessages(channelId, lastSeq);
  await subscribeToChannel(channelId);
  return missedMessages;
}
```

## Rate Limiting

### Per-Channel Limits

- **Chat messages**: 5 messages per 5 seconds per user
- **Presence updates**: 1 update per 30 seconds per user
- **Reactions**: 10 reactions per 10 seconds per user

### Enforcement

```typescript
const rateLimits = {
  "chat:message": { limit: 5, windowSec: 5 },
  "presence:join": { limit: 1, windowSec: 30 },
  "reaction:emoji": { limit: 10, windowSec: 10 },
};

async function checkRateLimit(
  userId: string,
  messageType: string
): Promise<boolean> {
  const config = rateLimits[messageType];
  if (!config) return true;

  const key = `ratelimit:${userId}:${messageType}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, config.windowSec);
  }

  return count <= config.limit;
}
```

## Monitoring

### Key Metrics

- **Message latency**: Time from publish to delivery
- **Sequence gaps**: Missing sequence numbers
- **Duplicate rate**: Messages delivered multiple times
- **Channel subscription count**: Active subscribers per channel
- **Message throughput**: Messages per second per channel

### Health Checks

```typescript
interface ChannelHealth {
  channelId: string;
  subscriberCount: number;
  messagesPerMinute: number;
  lastMessageTimestamp: number;
  sequenceGaps: number;
}
```

## Error Handling

### Client-Side Errors

```typescript
enum RealtimeError {
  CONNECTION_FAILED = "connection_failed",
  UNAUTHORIZED = "unauthorized",
  RATE_LIMITED = "rate_limited",
  INVALID_MESSAGE = "invalid_message",
  CHANNEL_NOT_FOUND = "channel_not_found",
}
```

### Recovery Strategies

- **Connection failed**: Exponential backoff reconnection
- **Unauthorized**: Request new token with valid channels
- **Rate limited**: Queue messages and retry after window
- **Invalid message**: Log error and skip message
- **Channel not found**: Revalidate channel existence

## Testing

### Unit Test Example

```typescript
describe("Message ordering", () => {
  it("generates monotonic sequence numbers", async () => {
    const msg1 = await publishRealtimeMessage("stream:test:chat", "chat:message", { text: "hi" });
    const msg2 = await publishRealtimeMessage("stream:test:chat", "chat:message", { text: "there" });

    expect(msg1.seq).toBe(1);
    expect(msg2.seq).toBe(2);
    expect(msg2.timestamp).toBeGreaterThanOrEqual(msg1.timestamp);
  });
});
```

### Integration Test Example

```typescript
describe("Message deduplication", () => {
  it("ignores duplicate messages with same sequence number", () => {
    const deduplicator = new MessageDeduplicator();
    
    const msg = {
      channelId: "stream:test:chat",
      type: "chat:message",
      payload: { text: "hello" },
      timestamp: Date.now(),
      seq: 1,
    };

    expect(deduplicator.shouldProcess(msg)).toBe(true);
    expect(deduplicator.shouldProcess(msg)).toBe(false); // Duplicate
  });
});
```

## Best Practices

1. **Always use sequence numbers** for ordering when available
2. **Implement client-side deduplication** for all message types
3. **Handle connection recovery** gracefully with message catch-up
4. **Validate channel permissions** before subscribing
5. **Monitor sequence gaps** to detect delivery issues
6. **Use appropriate rate limits** per message type
7. **Log failed deliveries** for debugging and monitoring

## References

- Issue #1815: Real-time message delivery guarantees
- Issue #1449: Realtime Pub/Sub backbone implementation
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)

## Support

For technical questions, open an issue or contact the development team.
