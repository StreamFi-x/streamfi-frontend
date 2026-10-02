/**
 * GET /api/routes-f/channel-weekly-schedule?creator_id=<id>
 *   Returns the creator's current recurring weekly stream schedule.
 *
 *   Response 200:
 *     { creator_id, schedule: [{ day_of_week, start_time, duration_minutes, title? }], updated_at }
 *
 *   Error responses:
 *     400 — creator_id missing/empty
 *     404 — creator not found
 *
 * PUT /api/routes-f/channel-weekly-schedule
 *   Replace a creator's full weekly schedule.
 *
 *   Body: { creator_id, schedule: [...slots] }
 *
 *   Response 200:
 *     { creator_id, schedule, updated_at }
 *
 *   Error responses:
 *     400 — invalid body (missing fields, bad day_of_week, bad HH:MM, etc.)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateQuery } from "@/app/api/routes-f/_lib/validate";
import { scheduleStore } from "./store";
import type { ChannelSchedule, ScheduleResponse } from "./types";

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

/** Matches HH:MM in 24-hour format: 00:00 – 23:59 */
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const slotSchema = z.object({
  day_of_week: z
    .number({ invalid_type_error: "day_of_week must be a number" })
    .int("day_of_week must be an integer")
    .min(0, "day_of_week must be 0–6")
    .max(6, "day_of_week must be 0–6"),
  start_time: z
    .string()
    .regex(timeRegex, "start_time must be in HH:MM (24-hour) format"),
  duration_minutes: z
    .number({ invalid_type_error: "duration_minutes must be a number" })
    .int("duration_minutes must be an integer")
    .min(15, "duration_minutes must be at least 15")
    .max(720, "duration_minutes must be at most 720"),
  title: z.string().min(1).max(120).optional(),
});

const putSchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  schedule: z
    .array(slotSchema)
    .min(0)
    .max(21, "schedule may contain at most 21 slots"), // 3 slots/day × 7 days
});

const getQuerySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toResponse(entry: ChannelSchedule): ScheduleResponse {
  return {
    creator_id: entry.creator_id,
    schedule: entry.slots,
    updated_at: entry.updated_at,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) {return queryResult;}

  const { creator_id } = queryResult.data;
  const entry = scheduleStore.get(creator_id);

  if (!entry) {
    return NextResponse.json({ error: "Creator schedule not found" }, { status: 404 });
  }

  return NextResponse.json(toResponse(entry));
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { creator_id, schedule } = parsed.data;
  const updated_at = new Date().toISOString();

  const entry: ChannelSchedule = {
    creator_id,
    slots: schedule as ChannelSchedule["slots"],
    updated_at,
  };

  scheduleStore.set(creator_id, entry);

  return NextResponse.json(toResponse(entry));
}
