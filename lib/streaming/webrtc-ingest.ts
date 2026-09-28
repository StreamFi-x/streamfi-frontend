export interface WhipIngestConfig {
  endpointUrl: string; // e.g., https://global-whip.mux.com/v1/whip/live-stream-id
  streamKey: string;
  enableIceRestart: boolean;
  maxReconnectAttempts: number;
}

export type IngestMode = 'whip_ultra_low_latency' | 'rtmp_standard';

export interface IngestSessionMetrics {
  mode: IngestMode;
  estimatedLatencyMs: number;
  connectionState: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
  reconnectCount: number;
}

export class WebRtcWhipIngestClient {
  private config: WhipIngestConfig;
  private metrics: IngestSessionMetrics;

  constructor(config: WhipIngestConfig) {
    this.config = config;
    this.metrics = {
      mode: 'whip_ultra_low_latency',
      estimatedLatencyMs: 450, // Sub-second WebRTC latency vs ~2-4s RTMP
      connectionState: 'idle',
      reconnectCount: 0,
    };
  }

  public getMetrics(): IngestSessionMetrics {
    return { ...this.metrics };
  }

  /**
   * Generates WHIP HTTP POST headers and body for WebRTC session negotiation.
   */
  public createWhipSessionRequest(clientSdpOffer: string): {
    url: string;
    headers: Record<string, string>;
    body: string;
  } {
    if (!clientSdpOffer || clientSdpOffer.trim().length === 0) {
      throw new Error('Valid SDP offer required for WHIP negotiation.');
    }

    this.metrics.connectionState = 'connecting';
    return {
      url: this.config.endpointUrl,
      headers: {
        'Content-Type': 'application/sdp',
        Authorization: `Bearer ${this.config.streamKey}`,
      },
      body: clientSdpOffer,
    };
  }

  /**
   * Handles ICE / connection state change with automatic reconnection.
   */
  public handleConnectionStateChange(iceState: 'connected' | 'disconnected' | 'failed') {
    if (iceState === 'connected') {
      this.metrics.connectionState = 'connected';
    } else if (iceState === 'disconnected' || iceState === 'failed') {
      if (this.metrics.reconnectCount < this.config.maxReconnectAttempts) {
        this.metrics.reconnectCount++;
        this.metrics.connectionState = 'reconnecting';
      } else {
        this.metrics.connectionState = 'failed';
      }
    }
  }
}
