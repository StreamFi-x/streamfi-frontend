import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateBody } from "@/app/api/routes-f/_lib/validate";
import { getStore } from "../_lib/store";

const voteSchema = z.object({
  poll_id: z.string().min(1),
  viewer_id: z.string().min(1),
  option_index: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const result = await validateBody(req, voteSchema);
  if (result instanceof NextResponse) return result;

  const { poll_id, viewer_id, option_index } = result.data;
  const poll = getStore().get(poll_id);

  if (!poll) {
    return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  }

  if (isExpired(poll.ends_at)) {
    return NextResponse.json({ error: "Poll has ended" }, { status: 400 });
  }

  if (poll.voters.has(viewer_id)) {
    return NextResponse.json(
      { error: "Viewer has already voted" },
      { status: 409 }
    );
  }

  if (option_index < 0 || option_index >= poll.options.length) {
    return NextResponse.json({ error: "Invalid option index" }, { status: 400 });
  }

  poll.options[option_index].votes++;
  poll.voters.add(viewer_id);

  return NextResponse.json({ message: "Vote recorded" });
}

function isExpired(ends_at: string): boolean {
  return new Date() >= new Date(ends_at);
}
