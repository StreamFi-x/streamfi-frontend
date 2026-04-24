import { NextRequest } from "next/server";
import { sql } from "@vercel/postgres";
import { createRateLimiter } from "@/lib/rate-limit";

// 5 bug reports per IP per minute
const isRateLimited = createRateLimiter(60_000, 5);

export async function POST(req: NextRequest): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (await isRateLimited(ip)) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const body = await req.json();
  const { category, description, severity, reporter_id } = body;

  if (!category || !description) {
    return Response.json(
      { error: "category and description are required" },
      { status: 400 }
    );
  }

  const validSeverities = ["low", "medium", "high", "critical"];
  const safeSeverity = validSeverities.includes(severity) ? severity : "medium";

  try {
    await sql`
      INSERT INTO bug_reports (reporter_id, category, description, severity)
      VALUES (
        ${reporter_id ?? "anonymous"},
        ${category},
        ${description},
        ${safeSeverity}
      )
    `;
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[reports/bug/submit] DB error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
