# Chat Backpressure & Degradation Signal

_Implements GitHub issue #1139_

## Overview

When a stream goes viral — e.g., a sudden jump from 100 to 50,000 concurrent viewers — chat message
volume can spike by three to four orders of magnitude. Without backpressure, that load propagates
to every downstream consumer of chat: the database (`chat_messages`), the realtime fan-out layer,
moderation tooling, and client polling.

This system detects a spike using rolling Redis counters, derives a `SpikeLevel` (`normal` |
`degraded` | `critical`), and automatically applies a graduated degradation strategy. Recovery
happens automatically via Redis key TTLs — no operator intervention required.

---

## Spike Signals

Two independent Redis counters act as signals. Both use a **60-second sliding window** via
`INCR` + conditional `EXPIRE 60` (key is created fresh each window).

| Key | Incremented by | What it measures |
|-----|----------------|-----------------|
| `chat:msgrate:{streamerId}` | POST `/api/streams/chat` (accepted messages only) | Message throughput per stream |
| `chat:connrate:{streamerId}` | GET `/api/streams/chat` | Viewer connection/poll rate |

Rejected messages (spam, rate-limited, subscriber-only checks) do **not** increment `chat:msgrate`,
keeping the signal honest.

The derived `SpikeLevel` is stored in `chat:spikelevel:{streamerId}` with a **90-second TTL**. When
the message rate drops below the threshold, the next accepted message writes `'normal'` to this key;
if no messages are sent, the key expires automatically — either way the system recovers without
manual action.

---

## Thresholds

| Env var | Default | Meaning |
|---------|---------|---------|
| `CHAT_SPIKE_THRESHOLD_WARN` | `500` | msgs / 60 s → `degraded` |
| `CHAT_SPIKE_THRESHOLD_CRITICAL` | `2000` | msgs / 60 s → `critical` |
| `CHAT_CONN_SPIKE_THRESHOLD` | `1000` | connections / 60 s → `degraded` |

Connection rate maps to at most `degraded` (not `critical`); the final `effectiveLevel` used in
responses is the higher of the message-rate level and connection-rate level.

---

## Degradation Priority Order

What gets shed first, and in what order:

### Level 1 — `degraded` (≥ 500 msgs/60 s)

1. **Viewer banner shown** — `⚡ Chat is experiencing high traffic — messages may be slower than usual`
2. **Slow mode floor raised to 5 s** — `getEffectiveSlowMode(configured, 'degraded')` returns
   `max(configured, 5)`. The creator's manual setting is never lowered.
3. **Poll interval increased to 10 s** — `X-Poll-Interval: 10` header on GET responses. Clients
   that respect this header reduce their polling frequency automatically.

### Level 2 — `critical` (≥ 2000 msgs/60 s)

All of the above, plus:

4. **Typing indicators and presence updates shed** — `shouldShedTypingIndicators('critical')` returns
   `true`. These are purely cosmetic signals; shedding them first preserves actual message delivery.
5. **Slow mode floor raised to 15 s** — `getEffectiveSlowMode(configured, 'critical')` returns
   `max(configured, 15)`.
6. **Poll interval increased to 30 s** — `X-Poll-Interval: 30`.

**Silent message loss is never part of the degradation path.** All accepted messages are still
persisted and delivered; the degradation only slows the rate at which new messages can be sent and
reduces client-side polling pressure.

---

## Recovery

1. Once message rate drops below `CHAT_SPIKE_THRESHOLD_WARN`, the next accepted POST writes
   `'normal'` to `chat:spikelevel:{streamerId}`.
2. If no messages are sent at all (e.g., stream ends), the `chat:spikelevel` key expires after 90 s.
3. The `chat:msgrate` key expires after 60 s; the counter starts fresh in the next window.
4. The viewer banner disappears on the next spike-level poll, at most 15 s after recovery.

No operator action, config change, or deployment is needed to recover.

---

## Response Headers

Every response from the chat API carries spike-level signals as HTTP headers:

| Header | Endpoint | Value |
|--------|----------|-------|
| `X-Chat-Spike` | POST and GET `/api/streams/chat` | `normal` \| `degraded` \| `critical` |
| `X-Poll-Interval` | GET `/api/streams/chat` | seconds (3 / 10 / 30) |
| `X-Chat-Spike` | GET `/api/streams/chat/spike-level` | same as above |

Clients that cannot read POST response headers (e.g., read-only viewers who never send) poll the
public endpoint `GET /api/streams/chat/spike-level?streamerId=<uuid>` every 15 seconds.

---

## Public Spike-Level Endpoint

```
GET /api/streams/chat/spike-level?streamerId=<uuid>
```

No authentication required — spike level is not sensitive. Response:

```json
{
  "level": "degraded",
  "pollIntervalSeconds": 10,
  "slowModeEnforced": true
}
```

`slowModeEnforced` is `true` whenever `level !== 'normal'`, indicating that the spike floor is
actively raising slow mode above any creator-configured value.

---

## Client-Side Behaviour

`hooks/useChat.ts` tracks spike level via two paths:

1. **POST path**: reads `X-Chat-Spike` from each `sendMessage` response and calls `setSpikeLevel`.
2. **Poll path**: calls `GET /api/streams/chat/spike-level?streamerId=<streamerId>` via SWR every
   15 seconds. This covers read-only viewers who never send a message.

`components/stream/chat-section.tsx` accepts a `spikeLevel` prop and renders the degradation banner
when `level !== 'normal'`. The banner auto-hides when the level returns to `normal`.

---

## Redis Unavailability

All functions in `lib/chat-spike.ts` catch all Redis errors and return `'normal'`. When
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are absent (local dev, CI), `getUpstashRedis()`
returns `null` and every spike function short-circuits to `'normal'` without throwing. The app runs
normally with no spike detection rather than failing.

---

## Interaction with #1137 Slow Mode

`getEffectiveSlowMode(configuredSeconds, spikeLevel)` always applies `Math.max(configured, floor)`.
The creator's manually configured slow mode is never overridden downward — a spike can only raise
the floor. When the spike subsides, the effective interval reverts to the creator's setting
automatically.

## Interaction with #1138 Live Fan-out

Completely independent. The spike signal reads and writes only `chat:msgrate:*`, `chat:connrate:*`,
and `chat:spikelevel:*` Redis keys. It does not touch `live_fanout_jobs`, the notification tables,
or any webhook handler.

Env vars used by #1138 (`LIVE_FANOUT_BATCH_SIZE`, `LIVE_FANOUT_BATCH_DELAY_MS`) are unrelated to
this system.

---

## Load Simulation

To observe the level progression locally (requires Redis env vars for real counters; without them
all levels report `'normal'` as expected):

```bash
npx tsx scripts/simulate-chat-spike.ts
# or
npx ts-node scripts/simulate-chat-spike.ts
```

The script simulates a ramp from 100 to 50,000 concurrent viewers by calling
`recordAndGetSpikeLevel()` with synthetic streamer IDs at increasing call rates, and prints the
level, poll interval, and effective slow mode floor at each stage.

Expected output with Redis connected:

```
🟢  100 viewers  (~17 msgs/60s)    level=normal    poll=3s  slowMode≥3s
🟢  500 viewers  (~83 msgs/60s)    level=normal    poll=3s  slowMode≥3s
🟡  3000 viewers (~500 msgs/60s)   level=degraded  poll=10s slowMode≥5s
🟡  5000 viewers (~833 msgs/60s)   level=degraded  poll=10s slowMode≥5s
🔴  12000 viewers (~2000 msgs/60s) level=critical  poll=30s slowMode≥15s
🔴  50000 viewers (~8333 msgs/60s) level=critical  poll=30s slowMode≥15s
```
