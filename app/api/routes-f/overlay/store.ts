import crypto from "crypto";
import type { OverlayConfigRecord, OverlayPublicConfig, OverlaySettingsUpdate } from "./types";

export const configByToken = new Map<string, OverlayConfigRecord>();
export const configByUser = new Map<string, OverlayConfigRecord>();

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function resetOverlayStore() {
  configByToken.clear();
  configByUser.clear();

  // Seed default test creator
  const defaultToken = "test_overlay_token_secret_1234567890abcdef1234567890abcdef";
  const defaultRecord: OverlayConfigRecord = {
    user_id: "creator_test_overlay_user",
    theme: "streamfi",
    position: "bottom-right",
    font_size: 18,
    opacity: 0.95,
    token: defaultToken,
    alerts_enabled: true,
    channel_name: "AwesomeStreamer",
    updated_at: new Date().toISOString(),
  };

  configByUser.set(defaultRecord.user_id, defaultRecord);
  configByToken.set(defaultToken, defaultRecord);
}

// Initial seed
resetOverlayStore();

export function getOverlayByToken(token: string): OverlayPublicConfig | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const record = configByToken.get(token);
  if (!record) {
    return null;
  }

  // Scoped DTO: only safe presentation data is returned, zero sensitive data
  return {
    theme: record.theme,
    position: record.position,
    fontSize: record.font_size,
    opacity: record.opacity,
    primary_color: record.theme === "cyberpunk" ? "#00ffcc" : "#ac39f2",
    alerts_enabled: record.alerts_enabled ?? true,
    channel_name: record.channel_name ?? "Streamer",
  };
}

export function rotateOverlayToken(userId: string): { token: string } {
  let record = configByUser.get(userId);

  if (record) {
    // Invalidate old token immediately
    configByToken.delete(record.token);
  }

  const newToken = generateOpaqueToken();

  if (!record) {
    record = {
      user_id: userId,
      theme: "streamfi",
      position: "bottom-right",
      font_size: 16,
      opacity: 1.0,
      token: newToken,
      alerts_enabled: true,
      updated_at: new Date().toISOString(),
    };
  } else {
    record.token = newToken;
    record.updated_at = new Date().toISOString();
  }

  configByUser.set(userId, record);
  configByToken.set(newToken, record);

  return { token: newToken };
}

export function updateOverlayConfig(
  userId: string,
  updates: OverlaySettingsUpdate
): OverlayConfigRecord {
  let record = configByUser.get(userId);

  if (!record) {
    const token = generateOpaqueToken();
    record = {
      user_id: userId,
      theme: (updates.theme as OverlayConfigRecord["theme"]) || "streamfi",
      position: (updates.position as OverlayConfigRecord["position"]) || "bottom-right",
      font_size: updates.font_size ?? 16,
      opacity: updates.opacity ?? 1.0,
      token,
      alerts_enabled: updates.alerts_enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    configByToken.set(token, record);
  } else {
    if (updates.theme) {
      record.theme = updates.theme as OverlayConfigRecord["theme"];
    }
    if (updates.position) {
      record.position = updates.position as OverlayConfigRecord["position"];
    }
    if (updates.font_size !== undefined) {
      record.font_size = updates.font_size;
    }
    if (updates.opacity !== undefined) {
      record.opacity = updates.opacity;
    }
    if (updates.alerts_enabled !== undefined) {
      record.alerts_enabled = updates.alerts_enabled;
    }
    record.updated_at = new Date().toISOString();
    // Maintain token mapping
    configByToken.set(record.token, record);
  }

  configByUser.set(userId, record);
  return record;
}

export function getOverlayForUser(userId: string): OverlayConfigRecord | undefined {
  return configByUser.get(userId);
}
