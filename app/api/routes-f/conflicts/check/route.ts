/**
 * POST /api/routes-f/conflicts/check
 *
 * Public endpoint — no auth required.
 *
 * Check whether a username is available and return up to 4 alternative
 * suggestions when it is not.
 *
 * Request body: { "username": "alice" }
 *
 * Response (available):
 *   { "available": true }
 *
 * Response (unavailable):
 *   { "available": false, "reason": "taken" | "reserved" | "banned",
 *     "suggestions": ["alice_streams", "alice_tv", "thealice", "alice42"] }
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { usernameSchema } from "@/app/api/routes-f/_lib/schemas";
import { classifyRestriction } from "../_lib/reserved";

const checkBodySchema = z.object({
  username: usernameSchema,
});

/** Returns true when the username does not exist in users table and is not restricted. */
async function isAvailable(username: string): Promise<boolean> {
  const restriction = await classifyRestriction(username);
  if (restriction !== null) {
    return false;
  }

  const { rows } = await sql`
    SELECT 1 FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
  `;
  return rows.length === 0;
}

/** Generates up to 4 available username suggestions for a taken/restricted username. */
async function buildSuggestions(base: string): Promise<string[]> {
  const randomTwoDigit = () => String(Math.floor(Math.random() * 90) + 10);

  const candidates = [
    `${base}_streams`,
    `${base}_tv`,
    `the${base}`,
    `${base}${randomTwoDigit()}`,
  ];

  const available: string[] = [];
  for (const candidate of candidates) {
    // Skip if the candidate itself is too long for the username schema
    if (candidate.length > 30) {
      continue;
    }
    try {
      if (await isAvailable(candidate)) {
        available.push(candidate);
      }
    } catch {
      // DB error on a suggestion — skip silently
    }
  }

  return available;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, checkBodySchema);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const { username } = bodyResult.data;

  try {
    // 1. Check static/DB restrictions first
    const restriction = await classifyRestriction(username);
    if (restriction !== null) {
      const suggestions = await buildSuggestions(username);
      return NextResponse.json({
        available: false,
        reason: restriction,
        suggestions,
      });
    }

    // 2. Check database availability
    const { rows } = await sql`
      SELECT 1 FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1
    `;

    if (rows.length > 0) {
      const suggestions = await buildSuggestions(username);
      return NextResponse.json({
        available: false,
        reason: "taken",
        suggestions,
      });
    }

    return NextResponse.json({ available: true });
  } catch (err) {
    console.error("[conflicts/check] DB error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
