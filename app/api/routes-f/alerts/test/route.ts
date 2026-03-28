import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { ALERT_TYPES, type AlertType, ensureAlertSchema } from "../_lib/db";

const testAlertBodySchema = z.object({
  type: z.enum(ALERT_TYPES).default("tip"),
  actor_username: z.string().trim().min(1).max(50).optional(),
  custom_message: z.string().trim().min(1).max(280).optional(),
  payload: z.record(z.unknown()).optional(),
});

function buildMessage(
  type: AlertType,
  actorUsername?: string,
  customMessage?: string
) {
  if (customMessage) {
    return customMessage;
  }

  const actor = actorUsername ?? "Test viewer";

  switch (type) {
    case "tip":
      return `${actor} sent a test tip`;
    case "subscription":
      return `${actor} started a test subscription`;
    case "gift":
      return `${actor} sent a test gift`;
    case "raid":
      return `${actor} triggered a test raid`;
    case "follow":
      return `${actor} followed the channel in a test alert`;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, testAlertBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const type = bodyResult.data.type ?? "tip";
  const { actor_username, custom_message, payload = {} } = bodyResult.data;

  try {
    await ensureAlertSchema();

    const message = buildMessage(type, actor_username, custom_message);

    const { rows } = await sql`
      INSERT INTO route_f_alert_events (user_id, alert_type, message, payload, is_test)
      VALUES (
        ${session.userId},
        ${type},
        ${message},
        ${JSON.stringify({ actor_username, ...payload })},
        TRUE
      )
      RETURNING id, alert_type, message, payload, is_test, created_at
    `;

    return NextResponse.json(
      {
        delivery: "stored_for_polling",
        event: rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[alerts/test] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
