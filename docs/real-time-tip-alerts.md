# Real-Time Tip Alert Overlay System (#1368)

## Overview

The real-time tip alert system delivers confirmed Stellar tip payments to a broadcaster's OBS/streaming overlay via Server-Sent Events (SSE). When a viewer tips, the event flows through:

1. **Stellar Network** → Viewer initiates XLM transfer
2. **Webhook Handler** → `/api/routes-f/webhooks-stellar-payment` receives and verifies the transaction
3. **Tip Alert Broadcast** → POST `/api/routes-f/tip-alerts/broadcast` sends alert to connected overlay clients
4. **Stream Endpoint** → GET `/api/routes-f/tip-alerts/stream` delivers real-time alerts via SSE
5. **OBS Browser Source** → Renders the alert UI with animation, sound, etc.

## Architecture

### Components

#### 1. Stream Endpoint (`GET /api/routes-f/tip-alerts/stream`)
- **Authentication**: Creator ID + scoped broadcast token
- **Transport**: Server-Sent Events (SSE)
- **Connection**: Persistent WebSocket-like connection per overlay client
- **Response**: Stream of tip alert events in real-time

Query parameters:
```
GET /api/routes-f/tip-alerts/stream?creator_id=<uuid>&token=<jwt_or_token>
```

Event format:
```json
event: tip_alert
data: {
  "id": "tx_hash_or_id",
  "tipper_name": "StellarSam",
  "amount_xlm": "50.5",
  "amount_usd": "12.50",
  "message": "Keep building!",
  "timestamp": "2026-09-25T12:00:00Z"
}
```

#### 2. Broadcast Endpoint (`POST /api/routes-f/tip-alerts/broadcast`)
- **Authentication**: Internal API secret (`x-internal-secret` header)
- **Caller**: Stellar webhook handler (after tip verification)
- **Transport**: JSON POST
- **Queueing**: Alerts queue if no active connections; delivered on reconnect

Request body:
```json
{
  "creator_id": "uuid",
  "tipper_name": "string",
  "amount_xlm": "50.5",
  "amount_usd": "12.50",
  "message": "optional",
  "tx_hash": "stellar_tx_hash"
}
```

#### 3. Stellar Webhook Integration
- After tip verification and database commit, webhook calls broadcast endpoint
- Non-blocking (fires and forgets to avoid slowing webhook response)
- Includes retry of broadcast if tip alert service is temporarily down

## Usage

### For Broadcasters

1. **Get Broadcast Token**
   - Retrieve a scoped token from creator dashboard (implementation pending)
   - Token should be per-stream-session for security

2. **Connect to Stream**
   ```javascript
   const eventSource = new EventSource(
     `/api/routes-f/tip-alerts/stream?creator_id=${creatorId}&token=${token}`
   );

   eventSource.addEventListener('tip_alert', (event) => {
     const alert = JSON.parse(event.data);
     showTipAlert(alert); // Your overlay renderer
   });

   eventSource.addEventListener('connection', (event) => {
     console.log('Overlay connected to tip stream');
   });

   eventSource.onerror = () => {
     console.error('Stream disconnected, will retry...');
   };
   ```

3. **Configure OBS Browser Source**
   - Add Browser Source in OBS
   - URL: `https://app.streamfi.com/overlay/tip-alerts?creator_id=<id>&token=<token>`
   - Width: 1920, Height: 1080 (or your stream resolution)
   - Uncheck "Control audio via OBS"
   - Interact: On (for click-to-dismiss)

### For Developers

#### Connection Flow
```
Client → GET /api/routes-f/tip-alerts/stream
  ↓
Server → Validate token
  ↓
Server → Return SSE stream (Content-Type: text/event-stream)
  ↓
Client → EventSource opens persistent connection
  ↓
Connection Established → Send "connection" event
  ↓
Tips Arrive → Receive "tip_alert" events in real-time
```

#### Queue Semantics
- Alerts queue per creator if no active connections
- On client reconnect, queued alerts flush immediately
- Max queue size: 100 alerts (oldest dropped if exceeded)
- Queue retention: 5 minutes (old alerts discarded)

#### Error Handling
- Network interruption: Client auto-reconnects with exponential backoff
- Invalid token: 401 response, stream closes
- Creator not found: 404 response
- Broadcast fails: Alert retries up to 3 times with 1s backoff

## Security

### Token Scope
- Tokens are creator-scoped: can only receive their own tips
- Short-lived (recommended 24h expiry)
- Revokable per stream session
- Should include creator ID in JWT payload

### Verification
- Stellar transactions verified on Horizon before alert broadcast
- Webhook signature verified (STELLAR_WEBHOOK_SECRET)
- Internal API calls require INTERNAL_API_SECRET
- No PII exposed in alert stream

### Rate Limiting
- Webhook endpoint: 60 req/min per IP
- Stream connections: No per-connection limit (scale with load)
- Alert queue: Per-creator, limited to 100 items

## Performance

### Scalability
- SSE connections are long-lived but resource-efficient
- In production, use distributed connection registry (Redis pub/sub)
- Current implementation: in-memory per-process (single server only)

### Latency
- Horizon verification: ~500ms (cached for 5min)
- Webhook processing: ~100ms (excluding verification)
- Alert delivery: <50ms (same-server or network latency)
- **Total: Tip → Overlay in ~1-2 seconds**

## Future Enhancements

1. **Alert Customization**
   - Configurable animation/duration per creator
   - Sound effects library
   - Custom HTML/CSS templates

2. **Multi-Creator Support**
   - Co-streamer alerts with routing
   - Squad/raid alerts bundled

3. **Delivery Guarantee** (#1209)
   - Dead-letter queue for failed alerts
   - Retry with exponential backoff
   - Alert event audit log

4. **Analytics**
   - Track alert impressions
   - Measure tipping impact on engagement
   - Heat map of alert timing

## Testing

### Manual Test Flow
```bash
# 1. Get creator_id and request token
curl -X POST /api/routes-f/tip-alerts/tokens \
  -H "Authorization: Bearer <session_token>" \
  -d "duration_minutes=60"

# 2. Connect stream client
curl --header "Accept: text/event-stream" \
  "/api/routes-f/tip-alerts/stream?creator_id=<id>&token=<token>"

# 3. Simulate tip via webhook (requires INTERNAL_API_SECRET)
curl -X POST /api/routes-f/tip-alerts/broadcast \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: <secret>" \
  -d '{
    "creator_id": "<id>",
    "tipper_name": "TestUser",
    "amount_xlm": "10",
    "amount_usd": "1.20",
    "tx_hash": "test_hash_123"
  }'

# 4. Verify alert received in step 2 stream
```

## Environment Variables

```
INTERNAL_API_SECRET=<secret>          # Shared secret for internal APIs
NEXT_PUBLIC_STELLAR_NETWORK=testnet   # stellar network (testnet or mainnet)
STELLAR_WEBHOOK_SECRET=<secret>       # Optional webhook signature verification
```

## References

- Server-Sent Events (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
- OBS Browser Source: https://github.com/obsproject/obs-studio/wiki/Sources-Guide#browser-source
- Stellar Horizon API: https://developers.stellar.org/api/introduction/
