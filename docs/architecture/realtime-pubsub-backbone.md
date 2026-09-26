# Realtime Pub/Sub Backbone & Connection Architecture

## 1. Overview (#1449)
StreamFi uses a serverless-friendly Realtime Pub/Sub architecture designed for high fan-out, horizontal scalability, and low latency without requiring persistent WebSocket servers on Vercel:
- **Transport**: Server-Sent Events (SSE) stream via `GET /api/realtime/events` supporting edge/serverless runtimes.
- **Pub/Sub Layer**: Upstash Redis REST pub/sub & sequence history lists with in-memory fallback for local dev.
- **Guaranteed Ordering**: Monotonic per-channel sequence numbers (`seq`) and timestamp IDs for strictly ordered client delivery and replay after disconnects.
- **Scoped Security**: `POST /api/realtime/token` mints HMAC-signed JWT tokens scoped to allowed channels (`stream:{playbackId}:chat`, `presence`, `status`), verifying session roles before granting private moderator or creator channels.
- **Resilient Client**: `RealtimeClient` with exponential backoff and jitter (1s base to 30s ceiling), automatic token refresh, and message deduplication.
