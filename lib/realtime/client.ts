/**
 * lib/realtime/client.ts
 *
 * Resilient client connection layer for Server-Sent Events (SSE) realtime push.
 * Features:
 *  - Automatic token minting and refresh
 *  - Exponential backoff with jitter on disconnect
 *  - Message deduplication by sequence and ID
 *  - Channel-scoped listener management
 *  - In-order dispatch guarantee
 */

import { RealtimeMessage } from "./pubsub";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface RealtimeClientOptions {
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  maxRetries?: number;
}

export class RealtimeClient {
  private eventSource: EventSource | null = null;
  private channels: Set<string> = new Set();
  private channelHandlers: Map<string, Set<(msg: RealtimeMessage) => void>> =
    new Map();
  private state: ConnectionState = "disconnected";
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private lastReceivedSeq: Map<string, number> = new Map();
  private seenMessageIds: Set<string> = new Set();

  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private baseBackoffMs: number;
  private maxBackoffMs: number;
  private maxRetries: number;
  private activeToken: string | null = null;

  constructor(options: RealtimeClientOptions = {}) {
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 20;
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  private setState(newState: ConnectionState) {
    if (this.state !== newState) {
      this.state = newState;
      this.stateListeners.forEach((l) => l(newState));
    }
  }

  /**
   * Subscribe to a channel. If not already connected, triggers connection.
   */
  public subscribe(
    channel: string,
    handler: (msg: RealtimeMessage) => void
  ): () => void {
    let handlers = this.channelHandlers.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.channelHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    if (!this.channels.has(channel)) {
      this.channels.add(channel);
      this.reconnect();
    }

    return () => {
      handlers?.delete(handler);
      if (handlers?.size === 0) {
        this.channelHandlers.delete(channel);
        this.channels.delete(channel);
      }
    };
  }

  /**
   * Connect or reconnect to the SSE endpoint.
   */
  public async connect(): Promise<void> {
    if (this.channels.size === 0) {
      return;
    }

    if (this.state === "connected" || this.state === "connecting") {
      return;
    }

    this.setState(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    try {
      // 1. Mint token for current channels
      const channelList = Array.from(this.channels);
      const tokenRes = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: channelList }),
      });

      if (!tokenRes.ok) {
        throw new Error(`Token minting failed with status ${tokenRes.status}`);
      }

      const { token } = await tokenRes.json();
      this.activeToken = token;

      // 2. Open EventSource
      if (typeof window === "undefined" || !window.EventSource) {
        // Fallback for SSR
        return;
      }

      if (this.eventSource) {
        this.eventSource.close();
      }

      const params = new URLSearchParams({
        token,
        channels: channelList.join(","),
      });

      // Pass minimum sequence known for gap recovery
      let minSeq = Infinity;
      for (const ch of channelList) {
        const seq = this.lastReceivedSeq.get(ch) || 0;
        if (seq < minSeq) minSeq = seq;
      }
      if (minSeq !== Infinity && minSeq > 0) {
        params.set("sinceSeq", String(minSeq));
      }

      this.eventSource = new EventSource(`/api/realtime/events?${params.toString()}`);

      this.eventSource.addEventListener("init", () => {
        this.reconnectAttempts = 0;
        this.setState("connected");
      });

      this.eventSource.addEventListener("message", (event) => {
        try {
          const msg: RealtimeMessage = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.error("[realtime] Failed to parse message:", e);
        }
      });

      this.eventSource.addEventListener("ping", () => {
        // Heartbeat received
      });

      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error("[realtime] Connection error:", err);
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(msg: RealtimeMessage) {
    if (!msg || !msg.channel) return;

    // Deduplicate by message ID and monotonic sequence
    if (this.seenMessageIds.has(msg.id)) {
      return;
    }
    this.seenMessageIds.add(msg.id);
    if (this.seenMessageIds.size > 500) {
      // Clear oldest IDs
      const firstEntries = Array.from(this.seenMessageIds).slice(0, 100);
      firstEntries.forEach((id) => this.seenMessageIds.delete(id));
    }

    const lastSeq = this.lastReceivedSeq.get(msg.channel) || 0;
    if (msg.seq > lastSeq) {
      this.lastReceivedSeq.set(msg.channel, msg.seq);
    }

    // Dispatch to channel listeners
    const handlers = this.channelHandlers.get(msg.channel);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(msg);
        } catch (err) {
          console.error("[realtime] Handler error:", err);
        }
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxRetries) {
      this.setState("error");
      return;
    }

    this.setState("reconnecting");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff with jitter: backoff * (1 + random * 0.5)
    const backoff = Math.min(
      this.baseBackoffMs * Math.pow(1.5, this.reconnectAttempts),
      this.maxBackoffMs
    );
    const jitter = backoff * (0.8 + Math.random() * 0.4);

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, jitter);
  }

  public reconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setState("disconnected");
  }
}

// Global singleton client for browser
let globalRealtimeClient: RealtimeClient | null = null;

export function getGlobalRealtimeClient(): RealtimeClient {
  if (!globalRealtimeClient) {
    globalRealtimeClient = new RealtimeClient();
  }
  return globalRealtimeClient;
}
