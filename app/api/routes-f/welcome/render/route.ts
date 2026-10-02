/**
 * POST /api/routes-f/welcome/render
 *
 * Render a creator's welcome message by substituting {{username}}.
 * Uses the same in-memory store as /api/routes-f/welcome.
 * No real DB — mock only.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { welcomeStore } from "@/app/api/routes-f/welcome/route";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------
const renderBodySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  username: z.string().min(1, "username is required"),
});

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, renderBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { creator_id, username } = bodyResult.data;

  const template = welcomeStore.get(creator_id);
  if (!template) {
    return NextResponse.json(
      {
        error: "No welcome template found",
        message: `Creator "${creator_id}" has not configured a welcome message template.`,
      },
      { status: 404 }
    );
  }

  // Replace ALL occurrences of the placeholder (replaceAll for safety).
  const message = template.replaceAll("{{username}}", username);

  return NextResponse.json({ message });
}
