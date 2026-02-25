import { NextResponse } from "next/server";

const MIN_DELAY_MS = 0;
const MAX_DELAY_MS = 10000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const msParam = url.searchParams.get("ms");

  if (msParam === null) {
    return NextResponse.json(
      {
        error: "Missing required parameter: ms",
        minDelay: MIN_DELAY_MS,
        maxDelay: MAX_DELAY_MS,
      },
      { status: 400 }
    );
  }

  const requestedDelay = parseInt(msParam, 10);

  if (isNaN(requestedDelay)) {
    return NextResponse.json(
      {
        error: "Invalid delay value: must be a number",
        provided: msParam,
        minDelay: MIN_DELAY_MS,
        maxDelay: MAX_DELAY_MS,
      },
      { status: 400 }
    );
  }

  if (requestedDelay < MIN_DELAY_MS || requestedDelay > MAX_DELAY_MS) {
    return NextResponse.json(
      {
        error: `Delay out of range: must be between ${MIN_DELAY_MS} and ${MAX_DELAY_MS}`,
        provided: requestedDelay,
        minDelay: MIN_DELAY_MS,
        maxDelay: MAX_DELAY_MS,
      },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  await new Promise((resolve) => setTimeout(resolve, requestedDelay));
  const actualDelay = Date.now() - startTime;

  return NextResponse.json(
    {
      requestedDelay,
      actualDelay,
      minDelay: MIN_DELAY_MS,
      maxDelay: MAX_DELAY_MS,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
