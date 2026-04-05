import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { verifySession } from "@/lib/auth/verify-session";

type NotificationPreferenceType =
  | "new_follower"
  | "stream_live"
  | "tip_received";

type NotificationChannel = "email" | "push" | "in_app";

type ChannelPreferences = Record<NotificationPreferenceType, boolean>;

type NotificationSettings = Record<NotificationChannel, ChannelPreferences>;

const CHANNELS: NotificationChannel[] = ["email", "push", "in_app"];
const TYPES: NotificationPreferenceType[] = [
  "new_follower",
  "stream_live",
  "tip_received",
];

const defaultSettings: NotificationSettings = {
  email: {
    new_follower: true,
    stream_live: true,
    tip_received: true,
  },
  push: {
    new_follower: true,
    stream_live: true,
    tip_received: true,
  },
  in_app: {
    new_follower: true,
    stream_live: true,
    tip_received: true,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDefaults(): NotificationSettings {
  return {
    email: { ...defaultSettings.email },
    push: { ...defaultSettings.push },
    in_app: { ...defaultSettings.in_app },
  };
}

function normaliseStoredSettings(input: unknown): NotificationSettings {
  const base = cloneDefaults();
  if (!isRecord(input)) {
    return base;
  }

  for (const channel of CHANNELS) {
    const current = input[channel];
    if (!isRecord(current)) {
      continue;
    }

    for (const type of TYPES) {
      if (typeof current[type] === "boolean") {
        base[channel][type] = current[type] as boolean;
      }
    }
  }

  return base;
}

function validatePatch(
  payload: unknown
): Record<NotificationChannel, Partial<ChannelPreferences>> {
  if (!isRecord(payload)) {
    throw new Error("Invalid request body");
  }

  const patch: Record<NotificationChannel, Partial<ChannelPreferences>> = {
    email: {},
    push: {},
    in_app: {},
  };

  for (const key of Object.keys(payload)) {
    if (!CHANNELS.includes(key as NotificationChannel)) {
      throw new Error(`Unknown notification channel: ${key}`);
    }

    const channel = key as NotificationChannel;
    const value = payload[channel];
    if (!isRecord(value)) {
      throw new Error(`Channel ${channel} must be an object`);
    }

    for (const innerKey of Object.keys(value)) {
      if (!TYPES.includes(innerKey as NotificationPreferenceType)) {
        throw new Error(`Unknown preference key: ${innerKey}`);
      }

      const prefKey = innerKey as NotificationPreferenceType;
      if (typeof value[prefKey] !== "boolean") {
        throw new Error(`Preference ${channel}.${prefKey} must be a boolean`);
      }

      patch[channel][prefKey] = value[prefKey] as boolean;
    }
  }

  return patch;
}

function applyPatch(
  current: NotificationSettings,
  patch: Record<NotificationChannel, Partial<ChannelPreferences>>
): NotificationSettings {
  const next = cloneDefaults();

  for (const channel of CHANNELS) {
    next[channel] = {
      ...current[channel],
      ...patch[channel],
    };
  }

  return next;
}

async function ensureSettingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS routes_f_notification_settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferences JSONB NOT NULL DEFAULT '{
        "email": {"new_follower": true, "stream_live": true, "tip_received": true},
        "push": {"new_follower": true, "stream_live": true, "tip_received": true},
        "in_app": {"new_follower": true, "stream_live": true, "tip_received": true}
      }'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getUserSettings(userId: string): Promise<NotificationSettings> {
  const result = await sql<{ preferences: unknown }>`
    SELECT preferences
    FROM routes_f_notification_settings
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (result.rows.length === 0) {
    await sql`
      INSERT INTO routes_f_notification_settings (user_id, preferences)
      VALUES (${userId}, ${JSON.stringify(defaultSettings)}::jsonb)
      ON CONFLICT (user_id) DO NOTHING
    `;

    return cloneDefaults();
  }

  return normaliseStoredSettings(result.rows[0].preferences);
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureSettingsTable();
    const preferences = await getUserSettings(session.userId);
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("[routes-f/notifications/settings] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  try {
    await ensureSettingsTable();

    const payload = await req.json();
    const patch = validatePatch(payload);
    const current = await getUserSettings(session.userId);
    const preferences = applyPatch(current, patch);

    await sql`
      INSERT INTO routes_f_notification_settings (user_id, preferences, updated_at)
      VALUES (${session.userId}, ${JSON.stringify(preferences)}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        preferences = EXCLUDED.preferences,
        updated_at = NOW()
    `;

    return NextResponse.json({ preferences });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[routes-f/notifications/settings] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}
