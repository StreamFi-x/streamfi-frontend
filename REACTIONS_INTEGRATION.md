# Reactions System Integration Guide

## Overview

The reactions system provides a dedicated, burst-tolerant real-time channel for viewer reactions (hearts, laughs, wow, fire, clap emojis) on streams. Unlike chat, reactions are:

- **Ephemeral**: Never persisted to database
- **Aggregated**: Individual taps are batched into counts per reaction type
- **Burst-tolerant**: Rate limiter allows rapid tapping without flooding
- **Lightweight**: No animation overhead from high-volume events

## Architecture

### Client → Server

1. **useReactions hook** - Manages UI state and sends reactions
2. **POST /api/streams/reactions** - Receives reaction, applies rate limit, publishes to realtime
3. **Rate Limiter** - Token bucket (20 token burst, 1/sec refill)
4. **Realtime Pub/Sub** - Publishes raw reaction event to `stream:${streamId}:reactions`

### Server → Client

1. **POST /api/realtime/reactions/broadcast** - Aggregates recent raw reactions into counts
2. **Realtime Pub/Sub** - Broadcasts aggregated counts to `stream:${streamId}:reactions:aggregated`
3. **useReactions hook** - Receives aggregated counts, updates UI
4. **ReactionBurst component** - Renders animations based on density (light/medium/heavy)

## Integration Steps

### 1. Add Reactions UI to Stream Viewer

```tsx
import { useReactions, useReactionKeyboard } from "@/hooks/useReactions";
import { ReactionBar, ReactionBurst } from "@/components/reactions";

export function StreamViewer({ playbackId, viewerId }) {
  const reactions = useReactions({
    playbackId,
    viewerId,
    enabled: true,
  });

  useReactionKeyboard(true, reactions.sendReaction);

  return (
    <>
      {/* Reaction animations */}
      {Object.entries(reactions.aggregatedReactions).map(
        ([type, count]) =>
          count > 0 && (
            <ReactionBurst
              key={type}
              reactionType={type as ReactionType}
              density={reactions.getReactionDensity(type as ReactionType)}
              count={count}
            />
          )
      )}

      {/* Reaction buttons */}
      <ReactionBar
        reactions={reactions.aggregatedReactions}
        onReactionClick={reactions.sendReaction}
      />
    </>
  );
}
```

### 2. Set Up Aggregation Broadcast Cron Job

The server needs to periodically call `POST /api/realtime/reactions/broadcast` for each active stream.

**Option A: Qstash Cron** (serverless, recommended)

```bash
curl -X POST https://api.qstash.io/v2/schedules \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -d '{
    "destination": "https://your-domain.com/api/realtime/reactions/broadcast",
    "method": "POST",
    "body": "{\"streamId\": \"stream-123\"}",
    "cron": "*/5 * * * * *",
    "headers": {
      "Authorization": "Bearer $INTERNAL_SECRET"
    }
  }'
```

**Option B: Traditional Cron Job**

Run every 200-500ms for active streams:

```bash
* * * * * for stream_id in $(curl -s http://localhost:3000/api/streams/active | jq -r '.[]'); do \
  curl -X POST http://localhost:3000/api/realtime/reactions/broadcast \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $SECRET" \
    -d "{\"streamId\": \"$stream_id\"}" \
done
```

### 3. Channel Authorization

The token endpoint already includes reactions channels in the whitelist:
- `stream:${streamId}:reactions` (raw event input)
- `stream:${streamId}:reactions:aggregated` (aggregated output for viewers)

No additional auth setup needed.

## Performance Characteristics

### Client Rate Limiting

- **Initial burst**: 20 rapid taps allowed instantly
- **Sustained rate**: 1 tap per second refills
- **Per-user, per-stream, per-reaction-type**
- **Prevents abuse** while allowing legitimate rapid-tap sequences

### Server Aggregation

- **Flush interval**: 200-500ms configurable
- **Input traffic**: High-frequency raw reactions → `stream:${streamId}:reactions`
- **Output traffic**: Single aggregated batch per flush → `stream:${streamId}:reactions:aggregated`
- **Broadcast reduction**: 1000+ raw events → 1 broadcast with counts

Example: 10,000 viewers each tapping a reaction 5 times:
- **Without aggregation**: 50,000 broadcasts to all viewers (catastrophic)
- **With aggregation**: ~1 broadcast per 200ms with reaction counts (efficient)

## Metrics & Analytics

Reactions are recorded to Redis with daily counters (non-real-time, batch-inserted):

- Key: `reactions:${streamId}:daily:YYYY-MM-DD`
- Field: `${reactionType}:count`
- TTL: 30 days

Query example:
```ts
const dailyCount = await redis.hgetall(
  `reactions:stream-123:daily:2024-01-15`
);
// { "heart:count": "4523", "laugh:count": "203", ... }
```

## Rate Limiting Behavior

### Legitimate Use

User rapidly taps heart button:
```
t=0ms:    tryConsume → ✓ (tokens: 19)
t=10ms:   tryConsume → ✓ (tokens: 18)
t=20ms:   tryConsume → ✓ (tokens: 17)
...
t=190ms:  tryConsume → ✓ (tokens: 0)
t=200ms:  tryConsume → ✗ (rate limited)
t=1200ms: tryConsume → ✓ (refilled 1, tokens: 0)
```

### Abuse Attempt

Automated spam every 10ms:
```
t=0ms:    tryConsume → ✓ (tokens: 19)
...
t=190ms:  tryConsume → ✓ (tokens: 0)
t=200ms:  tryConsume → ✗ (rate limited)
t=210ms:  tryConsume → ✗ (rate limited)
...
t=1200ms: tryConsume → ✓ (refilled 1, tokens: 0)
t=1210ms: tryConsume → ✗ (rate limited)
```

Result: Attacker floods at 100 events/second but only ~5 are allowed per second.

## Configuring Rate Limits

Adjust in `lib/reactions/rate-limiter.ts`:

```ts
export const REACTION_LIMITER_CONFIG: RateLimiterConfig = {
  capacity: 20,        // Initial tokens (burst size)
  refillRate: 1,       // Tokens added per second
  maxBurst: 20,        // Maximum tokens at once
};
```

Examples:
- **Generous**: `capacity: 50, refillRate: 2, maxBurst: 50` (less aggressive rate limiting)
- **Strict**: `capacity: 10, refillRate: 0.5, maxBurst: 10` (more restrictive)
- **Per-minute limit**: `capacity: 60, refillRate: 1, maxBurst: 60` (1 per second sustained)

## Testing

Run reaction tests:

```bash
npm test -- __tests__/lib/reactions
```

Tests cover:
- ✓ Burst allowance (20 rapid taps)
- ✓ Token refill over time
- ✓ Max burst ceiling
- ✓ Per-user and per-reaction separation
- ✓ Aggregation at high volume (1000+ events)
- ✓ Rate limit evasion prevention

## Monitoring

### Key Metrics to Track

1. **Reactions per minute** by stream/reaction type
2. **Rate limit rejection rate** (should be <1% for legitimate users)
3. **Aggregation flush latency** (should be <200ms)
4. **Realtime channel subscriber count** on reactions channels

### Logs to Watch

- `[reactions] Failed to send reaction` → Client-side errors
- `[reactions-broadcast] Batch published` → Server aggregation working
- `[reactions] Rate limited` → Heavy activity or abuse
- `[reactions-aggregator] Flush callback failed` → Broadcast issues

## Future Enhancements

1. **Custom emoji reactions** (per-stream configurable set)
2. **Reaction pinning** (highlight trending reactions)
3. **Creator earnings** (tips triggered by reactions?)
4. **Moderation** (block certain emojis per stream)
5. **Analytics dashboard** (reaction heatmaps over time)
