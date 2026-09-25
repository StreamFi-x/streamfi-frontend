export interface OverlayConfigRecord {
  user_id: string;
  theme: "default" | "dark" | "cyberpunk" | "minimal" | "streamfi";
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  font_size: number;
  opacity: number;
  token: string;
  alerts_enabled?: boolean;
  channel_name?: string;
  updated_at: string;
}

export interface OverlayPublicConfig {
  theme: string;
  position: string;
  fontSize: number;
  opacity: number;
  primary_color: string;
  alerts_enabled: boolean;
  channel_name?: string;
}

export interface OverlaySettingsUpdate {
  theme?: string;
  position?: string;
  font_size?: number;
  opacity?: number;
  alerts_enabled?: boolean;
}
