/**
 * GET  /api/routes-f/stinger?creator_id=
 *   Returns { active: stinger_id | null, library: [{ id, name, url }] }
 *
 * POST /api/routes-f/stinger/select
 *   Body: { creator_id, stinger_id }
 *   Sets the active stinger for the creator.
 *
 * POST /api/routes-f/stinger/add
 *   Body: { creator_id, name, url }
 *   Adds a new stinger to the creator's library (cap: 10).
 *
 * Scope: all files live inside app/api/routes-f/stinger/
 */

import { NextRequest, NextResponse } from "next/server";
import { validateQuery, validateBody } from "@/app/api/routes-f/_lib/validate";
import { querySchema, selectSchema, addSchema } from "./schema";
import { stingerStore, DEFAULT_STINGER, LIBRARY_CAP } from "./store";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const queryResult = validateQuery(searchParams, querySchema);
  if (queryResult instanceof NextResponse) return queryResult;

  const { creator_id } = queryResult.data;

  if (!stingerStore[creator_id]) {
    stingerStore[creator_id] = { active: null, library: [DEFAULT_STINGER] };
  }

  const state = stingerStore[creator_id];
  return NextResponse.json({ active: state.active, library: state.library });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const action = url.pathname.split("/").pop();

  if (action === "select") {
    const bodyResult = await validateBody(req, selectSchema);
    if (bodyResult instanceof NextResponse) return bodyResult;

    const { creator_id, stinger_id } = bodyResult.data;

    if (!stingerStore[creator_id]) {
      stingerStore[creator_id] = { active: null, library: [DEFAULT_STINGER] };
    }

    const state = stingerStore[creator_id];
    const found = state.library.find((s) => s.id === stinger_id);
    if (!found) {
      return NextResponse.json(
        { error: `Stinger '${stinger_id}' not found in library` },
        { status: 404 }
      );
    }

    state.active = stinger_id;
    return NextResponse.json({ active: state.active, library: state.library });
  }

  if (action === "add") {
    const bodyResult = await validateBody(req, addSchema);
    if (bodyResult instanceof NextResponse) return bodyResult;

    const { creator_id, name, url: stingerUrl } = bodyResult.data;

    if (!stingerStore[creator_id]) {
      stingerStore[creator_id] = { active: null, library: [DEFAULT_STINGER] };
    }

    const state = stingerStore[creator_id];

    if (state.library.length >= LIBRARY_CAP) {
      return NextResponse.json(
        { error: `Library cap of ${LIBRARY_CAP} stingers reached` },
        { status: 422 }
      );
    }

    const id = `custom-${Date.now()}`;
    const newStinger = { id, name, url: stingerUrl };
    state.library.push(newStinger);

    return NextResponse.json({ stinger: newStinger, library: state.library }, { status: 201 });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
