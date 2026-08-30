import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { addSchema } from "../schema";
import { stingerStore, DEFAULT_STINGER, LIBRARY_CAP } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, addSchema);
  if (bodyResult instanceof NextResponse) {return bodyResult;}

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
