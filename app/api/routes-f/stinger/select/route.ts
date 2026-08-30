import { NextRequest, NextResponse } from "next/server";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { selectSchema } from "../schema";
import { stingerStore, DEFAULT_STINGER } from "../store";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const bodyResult = await validateBody(req, selectSchema);
  if (bodyResult instanceof NextResponse) {return bodyResult;}

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
