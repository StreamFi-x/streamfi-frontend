import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type FirstTimeViewersResponse = {
  first_time_count: number;
  first_time_viewers: string[];
};

const querySchema = z.object({
  stream_id: z.string().min(1, "stream_id is required"),
});

type ViewerVisit = {
  viewer_id: string;
  is_first_time: boolean;
};

/** Bundled seed viewer history: which viewers watched each stream, and whether it was their first watch of this creator. */
const SEED_VIEWER_HISTORY: Record<string, ViewerVisit[]> = {
  "stream-1": [
    { viewer_id: "viewer-1", is_first_time: true },
    { viewer_id: "viewer-2", is_first_time: false },
    { viewer_id: "viewer-3", is_first_time: true },
    { viewer_id: "viewer-4", is_first_time: false },
    { viewer_id: "viewer-5", is_first_time: true },
  ],
  "stream-2": [
    { viewer_id: "viewer-6", is_first_time: false },
    { viewer_id: "viewer-7", is_first_time: false },
  ],
  "stream-3": [
    { viewer_id: "viewer-8", is_first_time: true },
    { viewer_id: "viewer-9", is_first_time: true },
    { viewer_id: "viewer-10", is_first_time: true },
  ],
};

function seedHistoryFor(streamId: string): ViewerVisit[] {
  const bundled = SEED_VIEWER_HISTORY[streamId];
  if (bundled) {return bundled;}

  const hash = streamId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = 3 + (hash % 6);
  const visits: ViewerVisit[] = [];
  for (let i = 0; i < count; i++) {
    visits.push({
      viewer_id: `viewer-seed-${hash}-${i}`,
      is_first_time: (hash + i) % 2 === 0,
    });
  }
  return visits;
}

export async function GET(req: NextRequest): Promise<NextResponse<FirstTimeViewersResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);
  const validation = querySchema.safeParse({ stream_id: searchParams.get("stream_id") });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { stream_id } = validation.data;
  const visits = seedHistoryFor(stream_id);
  const first_time_viewers = visits.filter((v) => v.is_first_time).map((v) => v.viewer_id);

  return NextResponse.json({
    first_time_count: first_time_viewers.length,
    first_time_viewers,
  });
}
