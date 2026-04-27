import { NextResponse } from "next/server";
import { getPollById } from "../_lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const poll = getPollById(id);

  if (!poll) {
    return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  }

  return NextResponse.json({ poll }, { status: 200 });
}
