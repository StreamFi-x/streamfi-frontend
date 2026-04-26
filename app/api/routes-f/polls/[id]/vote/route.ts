import { NextResponse } from "next/server";
import { getRequestIp } from "../../_lib/request";
import { voteOnPoll } from "../../_lib/store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const voterIp = getRequestIp(request);
    const poll = voteOnPoll(id, body.option_index, voterIp);

    return NextResponse.json({ poll }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record vote.";

    if (message === "Poll not found.") {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes("already voted")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
