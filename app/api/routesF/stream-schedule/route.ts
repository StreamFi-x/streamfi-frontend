import { NextResponse } from "next/server";
import { buildIcs } from "./ics";
import { scheduleForCreator } from "./seed-data";

const SUPPORTED_FORMATS = ["ics", "json"];

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const creatorId = url.searchParams.get("creator_id");
  const format = url.searchParams.get("format") ?? "ics";

  if (!creatorId) {
    return NextResponse.json(
      { error: "Missing required query parameter: creator_id" },
      { status: 400 }
    );
  }

  if (!SUPPORTED_FORMATS.includes(format)) {
    return NextResponse.json(
      {
        error: `Unsupported format: ${format}. Supported: ${SUPPORTED_FORMATS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const streams = scheduleForCreator(creatorId);

  if (streams.length === 0) {
    return NextResponse.json(
      { error: `No scheduled streams found for creator: ${creatorId}` },
      { status: 404 }
    );
  }

  if (format === "json") {
    return NextResponse.json({ creator_id: creatorId, streams });
  }

  return new Response(buildIcs(streams), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${creatorId}-schedule.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
