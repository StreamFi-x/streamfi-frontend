import { NextResponse } from "next/server";
import { createPoll } from "./_lib/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const poll = createPoll(body.question, body.options);

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create poll.",
      },
      { status: 400 }
    );
  }
}
