import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  ALERT_TYPES,
  DEFAULT_ALERT_CONFIG,
  type AlertType,
  ensureAlertSchema,
} from "./_lib/db";

const alertTypeSchema = z.enum(ALERT_TYPES);

const updateAlertConfigSchema = z
  .object({
    enabled_types: z.array(alertTypeSchema).max(ALERT_TYPES.length).optional(),
    display_duration_ms: z.number().int().min(1000).max(15000).optional(),
    sound_enabled: z.boolean().optional(),
    custom_message_template: z.string().trim().max(280).nullable().optional(),
  })
  .refine(body => Object.keys(body).length > 0, {
    message: "At least one field is required",
    path: ["body"],
  });

function toPgTextArray(values: AlertType[]) {
  return `{${values.map(value => `"${value}"`).join(",")}}`;
}

function mapConfigRow(row?: Record<string, unknown>) {
  const duration =
    typeof row?.display_duration_ms === "number"
      ? row.display_duration_ms
      : typeof row?.display_duration_ms === "string"
        ? Number(row.display_duration_ms)
        : null;

  return {
    enabled_types:
      (row?.enabled_types as AlertType[] | undefined) ??
      DEFAULT_ALERT_CONFIG.enabled_types,
    display_duration_ms:
      Number.isFinite(duration) && duration !== null
        ? duration
        : DEFAULT_ALERT_CONFIG.display_duration_ms,
    sound_enabled:
      typeof row?.sound_enabled === "boolean"
        ? row.sound_enabled
        : DEFAULT_ALERT_CONFIG.sound_enabled,
    custom_message_template:
      typeof row?.custom_message_template === "string"
        ? row.custom_message_template
        : null,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { searchParams } = new URL(req.url);
  const includeEvents = searchParams.get("include_events") === "true";

  try {
    await ensureAlertSchema();

    const { rows } = await sql`
      SELECT enabled_types, display_duration_ms, sound_enabled, custom_message_template
      FROM route_f_alert_configs
      WHERE user_id = ${session.userId}
      LIMIT 1
    `;

    const config = mapConfigRow(rows[0]);

    if (!includeEvents) {
      return NextResponse.json(config);
    }

    const { rows: eventRows } = await sql`
      SELECT id, alert_type, message, payload, is_test, created_at
      FROM route_f_alert_events
      WHERE user_id = ${session.userId}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({
      ...config,
      recent_events: eventRows,
    });
  } catch (error) {
    console.error("[alerts] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, updateAlertConfigSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const {
    enabled_types,
    display_duration_ms,
    sound_enabled,
    custom_message_template,
  } = bodyResult.data;

  try {
    await ensureAlertSchema();

    const nextEnabledTypes =
      enabled_types ?? DEFAULT_ALERT_CONFIG.enabled_types;
    const nextDuration =
      display_duration_ms ?? DEFAULT_ALERT_CONFIG.display_duration_ms;
    const nextSoundEnabled =
      sound_enabled ?? DEFAULT_ALERT_CONFIG.sound_enabled;
    const nextTemplate =
      custom_message_template === undefined
        ? DEFAULT_ALERT_CONFIG.custom_message_template
        : custom_message_template;

    const { rows } = await sql`
      INSERT INTO route_f_alert_configs (
        user_id,
        enabled_types,
        display_duration_ms,
        sound_enabled,
        custom_message_template,
        updated_at
      )
      VALUES (
        ${session.userId},
        ${toPgTextArray(nextEnabledTypes)}::text[],
        ${nextDuration},
        ${nextSoundEnabled},
        ${nextTemplate},
        now()
      )
      ON CONFLICT (user_id) DO UPDATE
      SET enabled_types = COALESCE(${enabled_types ? toPgTextArray(enabled_types) : null}::text[], route_f_alert_configs.enabled_types),
          display_duration_ms = COALESCE(${display_duration_ms ?? null}, route_f_alert_configs.display_duration_ms),
          sound_enabled = COALESCE(${sound_enabled ?? null}, route_f_alert_configs.sound_enabled),
          custom_message_template = CASE
            WHEN ${custom_message_template !== undefined} THEN ${custom_message_template ?? null}
            ELSE route_f_alert_configs.custom_message_template
          END,
          updated_at = now()
      RETURNING enabled_types, display_duration_ms, sound_enabled, custom_message_template
    `;

    return NextResponse.json(mapConfigRow(rows[0]));
  } catch (error) {
    console.error("[alerts] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
