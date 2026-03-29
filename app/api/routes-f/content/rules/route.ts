import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { verifySession } from "@/lib/auth/verify-session";
import { validateBody } from "@/app/api/routes-f/_lib/validate";

const severityEnum = z.enum(["low", "medium", "high"]);

const ruleSchema = z.object({
  id: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(2000),
  severity: severityEnum,
});

const patchRulesSchema = z.object({
  rules: z.array(ruleSchema).min(1).max(100),
});

const DEFAULT_RULES = [
  {
    id: "no-harassment",
    title: "No Harassment or Hate Speech",
    description: "Content that targets individuals or groups with harassment, threats, or hate speech is strictly prohibited.",
    severity: "high",
  },
  {
    id: "no-explicit-content",
    title: "No Explicit or Adult Content",
    description: "Sexually explicit content or nudity is not permitted on the platform.",
    severity: "high",
  },
  {
    id: "no-spam",
    title: "No Spam or Misleading Content",
    description: "Repetitive, misleading, or deceptive content that degrades the viewer experience is not allowed.",
    severity: "medium",
  },
  {
    id: "no-copyright",
    title: "Respect Copyright",
    description: "Do not stream or share content you do not have rights to broadcast.",
    severity: "medium",
  },
  {
    id: "no-self-harm",
    title: "No Self-Harm or Dangerous Activities",
    description: "Content that promotes or depicts self-harm, dangerous stunts, or illegal activities is prohibited.",
    severity: "high",
  },
];

async function ensureContentRulesSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_content_rules (
      id          SERIAL PRIMARY KEY,
      rules       JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { rows } = await sql`
    SELECT 1 FROM users WHERE id = ${userId} AND is_admin = TRUE LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * GET /api/routes-f/content/rules
 * Public endpoint — returns current platform content moderation rules.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    await ensureContentRulesSchema();

    const { rows } = await sql`
      SELECT rules, updated_at FROM route_f_content_rules ORDER BY id DESC LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({
        rules: DEFAULT_RULES.map(r => ({ ...r, updated_at: new Date().toISOString() })),
      });
    }

    return NextResponse.json({ rules: rows[0].rules, updated_at: rows[0].updated_at });
  } catch (error) {
    console.error("[routes-f content/rules GET]", error);
    return NextResponse.json({ error: "Failed to fetch content rules" }, { status: 500 });
  }
}

/**
 * PATCH /api/routes-f/content/rules
 * Admin-only — update platform content moderation rules.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await verifySession(req);
  if (!session.ok) return session.response;

  const admin = await isAdmin(session.userId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await validateBody(req, patchRulesSchema);
  if (bodyResult instanceof Response) return bodyResult;

  const now = new Date().toISOString();
  const rules = bodyResult.data.rules.map((r: z.infer<typeof ruleSchema>) => ({ ...r, updated_at: now }));

  try {
    await ensureContentRulesSchema();

    const { rows } = await sql`
      INSERT INTO route_f_content_rules (rules, updated_at)
      VALUES (${JSON.stringify(rules)}::jsonb, NOW())
      RETURNING rules, updated_at
    `;

    return NextResponse.json({ rules: rows[0].rules, updated_at: rows[0].updated_at });
  } catch (error) {
    console.error("[routes-f content/rules PATCH]", error);
    return NextResponse.json({ error: "Failed to update content rules" }, { status: 500 });
  }
}
