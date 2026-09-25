# Architecture & Specifications: GDPR Data Flow, Subscriber Perks, A11y, and WebRTC Ingest

Issues: #1432, #1433, #1440, #1441

## 1. Self-Service GDPR/CCPA Data Export & Erasure (#1441)
- **Export Package**: Assembles profile details, stream history, tips sent/received, subscription states, and preferences in structured JSON.
- **Erasure Policy**: Replaces PII with irreversible hashes while retaining aggregated/hashed financial records required for statutory tax accounting. Active dispute flags suspend erasure until resolution.

## 2. Structured Subscriber Perks & Emotes (#1433)
- **Tier Configuration**: Explicit typed structure attaching badges, custom emotes, and subscriber-only chat flags to specific tiers.
- **Server-Side Validation**: Ensures emote and badge privileges are strictly checked at message dispatch and maintained through the paid period even if cancelled.

## 3. Real-Time Chat & Video Accessibility (#1440)
- **ARIA Live Throttling**: Implements a polite ARIA-live announcer that automatically summarizes high-throughput chat storms rather than flooding screen readers.
- **Moderator Keyboard Navigation**: Full tab index and keyboard shortcut bindings for timeout, ban, and message deletion.

## 4. WebRTC WHIP Ultra-Low-Latency Ingest (#1432)
- **Protocol**: Implements Mux WebRTC HTTP Ingestion Protocol (WHIP) reducing broadcast latency from 2–4s to <500ms.
- **Resilience**: Auto-reconnect and ICE restart logic for connection drops.
