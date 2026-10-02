/**
 * GET /api/routes-f/moderation-auto-ban-regex?creator_id=<id>
 *   Returns the creator's configured auto-ban regex patterns.
 *
 *   Response 200:
 *     { creator_id, patterns: [{ pattern, flags, note, created_at }], updated_at }
 *
 *   Error responses:
 *     400 — creator_id missing/empty
 *     404 — creator has no auto-ban configuration
 *
 * PUT /api/routes-f/moderation-auto-ban-regex
 *   Replace a creator's full set of auto-ban regex patterns. Handles matching
 *   any configured pattern are auto-banned; each pattern is validated for
 *   well-formedness and checked against a nested-quantifier heuristic that
 *   guards against catastrophic-backtracking (ReDoS) patterns.
 *
 *   Body: { creator_id, patterns: [{ pattern, flags?, note? }] }
 *
 *   Response 200:
 *     { creator_id, patterns, updated_at }
 *
 *   Error responses:
 *     400 — invalid body, unsafe/invalid regex pattern, disallowed flags, too many patterns
 */
import { NextRequest, NextResponse } from "next/server";
import type { AutoBanRegexPattern, AutoBanRegexResponse } from "./types";
import { getConfig, putConfig } from "./store";
import { validateAutoBanPattern } from "./validate-pattern";

const MAX_PATTERNS = 25;

function toResponse(
  creatorId: string,
  patterns: AutoBanRegexPattern[],
  updatedAt: string
): AutoBanRegexResponse {
  return { creator_id: creatorId, patterns, updated_at: updatedAt };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const creatorId = req.nextUrl.searchParams.get("creator_id");
  if (!creatorId) {
    return NextResponse.json(
      { error: "creator_id is required" },
      { status: 400 }
    );
  }

  const config = getConfig(creatorId);
  if (!config) {
    return NextResponse.json(
      { error: `no auto-ban configuration for creator_id: ${creatorId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(
    toResponse(config.creator_id, config.patterns, config.updated_at)
  );
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let body: {
    creator_id?: unknown;
    patterns?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creator_id, patterns } = body;

  if (!creator_id || typeof creator_id !== "string") {
    return NextResponse.json(
      { error: "creator_id is required and must be a string" },
      { status: 400 }
    );
  }

  if (!Array.isArray(patterns)) {
    return NextResponse.json(
      { error: "patterns must be an array" },
      { status: 400 }
    );
  }

  if (patterns.length > MAX_PATTERNS) {
    return NextResponse.json(
      { error: `patterns may contain at most ${MAX_PATTERNS} entries` },
      { status: 400 }
    );
  }

  const normalized: AutoBanRegexPattern[] = [];
  const now = new Date().toISOString();

  for (const [index, raw] of patterns.entries()) {
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json(
        { error: `patterns[${index}] must be an object` },
        { status: 400 }
      );
    }

    const entry = raw as { pattern?: unknown; flags?: unknown; note?: unknown };
    const validation = validateAutoBanPattern(entry.pattern, entry.flags);
    if (!validation.ok) {
      return NextResponse.json(
        { error: `patterns[${index}]: ${validation.error}` },
        { status: 400 }
      );
    }

    if (entry.note !== undefined && typeof entry.note !== "string") {
      return NextResponse.json(
        { error: `patterns[${index}].note must be a string` },
        { status: 400 }
      );
    }

    normalized.push({
      pattern: entry.pattern as string,
      flags: (entry.flags as string | undefined) ?? "",
      note: (entry.note as string | undefined) ?? "",
      created_at: now,
    });
  }

  const config = putConfig(creator_id, normalized);

  return NextResponse.json(
    toResponse(config.creator_id, config.patterns, config.updated_at)
  );
}
