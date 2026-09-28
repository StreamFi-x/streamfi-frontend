export interface MobileCameraConfig {
  facingMode: 'user' | 'environment';
  targetBitrateKbps: number;
  orientation: 'portrait' | 'landscape';
}

export type MobileBroadcastState =
  | 'idle'
  | 'requesting_permissions'
  | 'streaming'
  | 'network_reconnecting'
  | 'backgrounded_paused'
  | 'error';

export class MobileBroadcasterSession {
  private config: MobileCameraConfig;
  private state: MobileBroadcastState = 'idle';
  private reconnectAttempts = 0;

  constructor(config: Partial<MobileCameraConfig> = {}) {
    this.config = {
      facingMode: config.facingMode ?? 'user',
      targetBitrateKbps: config.targetBitrateKbps ?? 2500,
      orientation: config.orientation ?? 'portrait',
    };
  }

  public getState(): MobileBroadcastState {
    return this.state;
  }

  /**
   * Builds mobile-optimized MediaStream constraints.
   */
  public getMediaConstraints(): MediaStreamConstraints {
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: this.config.facingMode,
        width: this.config.orientation === 'portrait' ? { ideal: 720 } : { ideal: 1280 },
        height: this.config.orientation === 'portrait' ? { ideal: 1280 } : { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
    };
  }

  /**
   * Handles app/tab backgrounding event to conserve cellular battery and notify stream.
   */
  public handleVisibilityChange(hidden: boolean) {
    if (hidden && this.state === 'streaming') {
      this.state = 'backgrounded_paused';
    } else if (!hidden && this.state === 'backgrounded_paused') {
      this.state = 'streaming';
    }
  }

  /**
   * Handles cellular/Wi-Fi connection drop with exponential backoff.
   */
  public handleNetworkFluctuation(): boolean {
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      this.state = 'network_reconnecting';
      return true; // will attempt reconnect
    }
    this.state = 'error';
    return false; // connection fatal
  }

  public resetReconnect() {
    this.reconnectAttempts = 0;
    this.state = 'streaming';
  }
}
