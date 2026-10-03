# Sandboxed Extension & Overlay Runtime Architecture

## 1. Security Model & Execution Isolation (#1445)
StreamFi extensions render directly over live video streams and panels. To prevent malicious third-party code from exfiltrating viewer PII, hijacking DOM elements, or compromising creator streams, the runtime implements a strict sandboxed isolation model:

### Execution Boundary
- **Iframe Sandboxing**: Overlays are executed inside `<iframe sandbox="allow-scripts">`.
- **Restricted Privileges**:
  - NO `allow-same-origin`: Extension scripts cannot access parent cookies, localStorage, session tokens, or parent window DOM.
  - NO `allow-top-navigation`: Extension scripts cannot redirect or hijack the host page.
  - NO direct networking to internal API routes.

---

## 2. PostMessage RPC Protocol (`STREAMFI_EXTENSION_RPC_V1`)
Extensions interact with StreamFi exclusively via a scoped postMessage RPC interface:

```typescript
// Extension -> Host Request
window.parent.postMessage({
  protocol: "STREAMFI_EXTENSION_RPC_V1",
  extensionId: "ext-uuid",
  requestId: "req-1",
  action: "GET_STREAM_STATS"
}, "*");

// Host -> Extension Response
{
  protocol: "STREAMFI_EXTENSION_RPC_V1",
  requestId: "req-1",
  ok: true,
  data: {
    viewers: 1420,
    uptime: 3600
  }
}
```

---

## 3. Platform & Creator Kill-Switch
- Creators and platform administrators can immediately terminate any rogue or memory-leaking extension via `POST /api/routes-f/stream/extensions/[id]/kill-switch`.
- Kill-switch updates database status to `is_enabled = FALSE` and broadcasts `extension:kill` over the `stream:${playbackId}:overlay` realtime channel, instantly unmounting the iframe across all active viewers.
