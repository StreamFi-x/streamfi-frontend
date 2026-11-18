import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { listEmailDeadLetters } from "@/lib/email/reliable-sender";
import { logger } from "@/lib/tracing/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/email-dead-letters
 *
 * Returns dead-lettered transactional emails that failed delivery even after
 * retries (#1748), enabling operators to inspect and backfill failed messages.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { response: adminDenied } = await authorizeAdmin(
    req,
    "admin/email-dead-letters"
  );
  if (adminDenied) {
    return adminDenied;
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "50");
    const includeResolved = searchParams.get("includeResolved") === "true";

    const deadLetters = await listEmailDeadLetters({
      limit: Number.isFinite(limit) ? limit : 50,
      includeResolved,
    });

    return NextResponse.json({ deadLetters });
  } catch (err) {
    logger.error("Failed to list email dead letters", err, {
      route: "GET /api/admin/email-dead-letters",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
