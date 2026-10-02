/**
 * GET /api/routes-f/welcome?creator_id=
 * PUT /api/routes-f/welcome
 *
 * Manage the welcome message template for a creator.
 * Template MUST contain the {{username}} placeholder.
 * Uses in-memory storage (mock) — no real DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody, validateQuery } from "@/app/api/routes-f/_lib/validate";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_TEMPLATE = "Welcome, {{username}}! Thanks for following.";
const USERNAME_PLACEHOLDER = "{{username}}";

// ---------------------------------------------------------------------------
// In-memory storage
// Key: creator_id
// Exported so tests can reset between runs.
// ---------------------------------------------------------------------------
export const welcomeStore: Map<string, string> = new Map();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------
const getQuerySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
});

const putBodySchema = z.object({
  creator_id: z.string().min(1, "creator_id is required"),
  template: z.string().min(1, "template is required"),
});

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, getQuerySchema);
  if (queryResult instanceof NextResponse) {
    return queryResult;
  }

  const { creator_id } = queryResult.data;
  const template = welcomeStore.get(creator_id) ?? DEFAULT_TEMPLATE;

  return NextResponse.json({ creator_id, template });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, putBodySchema);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const { creator_id, template } = bodyResult.data;

  if (!template.includes(USERNAME_PLACEHOLDER)) {
    return NextResponse.json(
      {
        error: "Invalid template",
        message: `Template must contain the "${USERNAME_PLACEHOLDER}" placeholder.`,
      },
      { status: 400 }
    );
  }

  welcomeStore.set(creator_id, template);

  return NextResponse.json({ creator_id, template });
}
