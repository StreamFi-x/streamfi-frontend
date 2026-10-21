# Chat typing indicators

Typing indicators tell viewers that someone is composing a chat message. They
are **ephemeral**: they never touch `chat_messages` or any table, and they use a
realtime channel separate from message delivery.

## Data flow

```
input change ──throttle──▶ POST /api/streams/chat/typing ──policy──▶ stream:{playbackId}:typing
                                                                         │ (SSE, same transport as chat push)
                                                    TypingTracker ◀──────┘
                                                    (expiry + grace)  ──▶ "Alice and Bob are typing…"
```

- Channel: `stream:{playbackId}:typing`, event `chat:typing`,
  payload `{ state: "typing" | "stopped", username, wallet }`.
- `lib/realtime/pubsub.ts` treats `:typing` channels as ephemeral: no in-memory
  history, no replay to reconnecting clients, and in Redis only a 20-entry
  buffer with a 10 s TTL (needed so the cross-instance SSE poller can deliver
  the event). Chat channels keep their 50-entry / 1 h history.
- The sender is always taken from the verified session, never from the body.

## Client behaviour (`hooks/useTypingIndicator.ts`, `lib/chat-typing.ts`)

| Rule | Value |
| --- | --- |
| Max outgoing `typing` rate | 1 per 2 s while keys are pressed |
| Idle → `stopped` | 3 s without input |
| `stopped` also sent | input cleared, message submitted |
| Remote indicator expiry | 5 s without an update (covers closed tabs) |
| Stop grace | 1 s after an explicit `stopped`, so stop/start does not flicker |
| Display | 1 name; 2 names joined with "and"; 3+ as "N people are typing…" |
| Back-off | 30 s of silence after a 429 or a suppressed response |

A viewer never sees their own indicator (matched by wallet).

## Server policy (`decideTypingBroadcast`)

Evaluated in this order; the first match suppresses the event. Suppressed
events answer `202 { broadcast: false, reason }`, which tells the client to back
off. They are never errors.

1. **Critical chat load** (`shouldShedTypingIndicators`, see
   [chat-backpressure.md](./chat-backpressure.md)) → `load-shed`.
2. **More than 2000 viewers** → `viewer-cutoff`. Typing is disabled, including
   `stopped`, because nobody can reliably read a typing line in a chat that busy.
3. `stopped` events pass from here on (they only clear indicators).
4. **Muted** (an active chat timeout) → `timed-out`.
5. **Slow-mode cooldown not elapsed** → `slow-mode`. The user cannot send yet,
   so "typing" would mislead.
6. **201–2000 viewers** → a room-wide budget of 5 `typing` events/second;
   beyond it → `room-sampled`.
7. Up to 200 viewers every event is broadcast.

Additionally each user is limited to 4 events per 5 s per stream (HTTP 429).

Viewer counts come from presence (`getLivePresence`, keyed by the streamer id).
If presence is unavailable the room is treated as small.

### Known limits

- Timeouts are read from the in-memory chat-timeout store; like that store, they
  are per-instance until timeouts are persisted.
- Subscriber-only chat is not checked: a non-subscriber's typing is shown even
  though their send would be rejected. Add a check alongside the mute check if
  that matters.
- Only the main chat input is wired. The fullscreen overlay input does not emit
  typing events yet.
