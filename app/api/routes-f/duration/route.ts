import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import {
  DurationComponents,
  durationToSeconds,
  formatDuration,
  parseDuration,
} from "@/app/api/routes-f/_lib/duration";

const durationComponentsSchema = z.object({
  years: z.number().min(0).optional(),
  months: z.number().min(0).optional(),
  weeks: z.number().min(0).optional(),
  days: z.number().min(0).optional(),
  hours: z.number().min(0).optional(),
  minutes: z.number().min(0).optional(),
  seconds: z.number().min(0).optional(),
});

const durationBodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("parse"), text: z.string() }),
  z.object({ mode: z.literal("format"), components: durationComponentsSchema }),
]);

export async function POST(req: NextRequest) {
  const validated = await validateBody(req, durationBodySchema);
  if (validated instanceof NextResponse) {
    return validated;
  }

  const { mode } = validated.data;

  if (mode === "parse") {
    const { text } = validated.data;
    try {
      const parsed = parseDuration(text);
      return NextResponse.json({
        text,
        components: parsed,
        total_seconds: durationToSeconds(parsed),
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Invalid ISO duration.",
        },
        { status: 400 }
      );
    }
  }

  try {
    const { components } = validated.data;
    const formatted = formatDuration(components as DurationComponents);
    const normalized = parseDuration(formatted);
    return NextResponse.json({
      text: formatted,
      components: normalized,
      total_seconds: durationToSeconds(normalized),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to format duration.",
      },
      { status: 400 }
    );
  }
}
