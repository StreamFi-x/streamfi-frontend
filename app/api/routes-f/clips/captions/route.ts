import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { uuidSchema } from "@/app/api/routes-f/_lib/schemas";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";
import {
  ensureCaptionsSchema,
  validateWebVTT,
  validateLanguageTag,
} from "./_lib/db";

const listCaptionsQuerySchema = z.object({
  clip_id: uuidSchema,
});

const uploadCaptionSchema = z.object({
  clip_id: uuidSchema,
  language: z.string().trim().min(2).max(10),
  label: z.string().trim().min(1).max(255),
  vtt_content: z.string().trim().min(1),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, listCaptionsQuerySchema);
  if (queryResult instanceof Response) {
    return queryResult;
  }

  try {
    await ensureCaptionsSchema();

    const { clip_id } = queryResult.data;

    const { rows } = await sql`
      SELECT id, language, label, created_at
      FROM route_f_clip_captions
      WHERE clip_id = ${clip_id}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      captions: rows.map(row => ({
        id: row.id,
        language: row.language,
        label: row.label,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    console.error("[clips/captions] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const bodyResult = await validateBody(req, uploadCaptionSchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  try {
    await ensureCaptionsSchema();

    const { clip_id, language, label, vtt_content } = bodyResult.data;

    // Validate language tag
    if (!validateLanguageTag(language)) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: [
            {
              field: "language",
              message:
                "Language must be a valid BCP-47 tag (e.g., en, es, fr, en-US)",
            },
          ],
        },
        { status: 400 }
      );
    }

    // Validate WebVTT content
    if (!validateWebVTT(vtt_content)) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: [
            {
              field: "vtt_content",
              message:
                "Content must be valid WebVTT format (must start with WEBVTT and contain at least one cue)",
            },
          ],
        },
        { status: 400 }
      );
    }

    // Check clip exists and user owns it
    const { rows: clipRows } = await sql`
      SELECT id FROM stream_recordings
      WHERE id = ${clip_id} AND user_id = ${session.userId}
      LIMIT 1
    `;

    if (clipRows.length === 0) {
      return NextResponse.json(
        { error: "Clip not found or unauthorized" },
        { status: 404 }
      );
    }

    // Check caption count for this clip
    const { rows: countRows } = await sql`
      SELECT COUNT(*)::int as count FROM route_f_clip_captions
      WHERE clip_id = ${clip_id}
    `;

    if (countRows[0].count >= 5) {
      return NextResponse.json(
        {
          error: "Validation failed",
          issues: [
            {
              field: "clip_id",
              message: "Maximum 5 caption tracks per clip",
            },
          ],
        },
        { status: 400 }
      );
    }

    // Upsert caption
    const { rows } = await sql`
      INSERT INTO route_f_clip_captions (clip_id, language, label, vtt_content, created_at)
      VALUES (${clip_id}, ${language}, ${label}, ${vtt_content}, now())
      ON CONFLICT (clip_id, language) DO UPDATE SET
        label = EXCLUDED.label,
        vtt_content = EXCLUDED.vtt_content
      RETURNING id, language, label, created_at
    `;

    return NextResponse.json(
      {
        id: rows[0].id,
        language: rows[0].language,
        label: rows[0].label,
        created_at: rows[0].created_at,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[clips/captions] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) {
    return session.response;
  }

  const { pathname } = new URL(req.url);
  const captionId = pathname.split("/").pop();

  if (!captionId || !uuidSchema.safeParse(captionId).success) {
    return NextResponse.json({ error: "Invalid caption ID" }, { status: 400 });
  }

  try {
    await ensureCaptionsSchema();

    // Verify ownership
    const { rows: captionRows } = await sql`
      SELECT cc.id FROM route_f_clip_captions cc
      JOIN stream_recordings sr ON cc.clip_id = sr.id
      WHERE cc.id = ${captionId} AND sr.user_id = ${session.userId}
      LIMIT 1
    `;

    if (captionRows.length === 0) {
      return NextResponse.json(
        { error: "Caption not found or unauthorized" },
        { status: 404 }
      );
    }

    await sql`
      DELETE FROM route_f_clip_captions WHERE id = ${captionId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[clips/captions] DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
