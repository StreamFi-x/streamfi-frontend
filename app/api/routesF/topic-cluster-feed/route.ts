import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type SeedStream = {
  stream_id: string;
  creator_username: string;
  title: string;
  topic: string;
  viewer_count: number;
};

type ClusterStream = Omit<SeedStream, "topic">;

type TopicCluster = {
  topic: string;
  streams: ClusterStream[];
};

type ClustersResponse = {
  clusters: TopicCluster[];
};

const querySchema = z.object({
  viewer_id: z.string().optional(),
});

/** Bundled seed streams tagged with discovered topic clusters. */
const SEED_STREAMS: SeedStream[] = [
  { stream_id: "stream-1", creator_username: "novastreams", title: "Ranked grind to Diamond", topic: "esports", viewer_count: 1420 },
  { stream_id: "stream-2", creator_username: "clipnation", title: "Valorant scrims", topic: "esports", viewer_count: 980 },
  { stream_id: "stream-3", creator_username: "pixelpatch", title: "Weeknight pasta from scratch", topic: "cooking", viewer_count: 640 },
  { stream_id: "stream-4", creator_username: "walletwiz", title: "Lo-fi beats and chat", topic: "chill music", viewer_count: 1105 },
  { stream_id: "stream-5", creator_username: "novastreams", title: "Sunday brunch cook-along", topic: "cooking", viewer_count: 420 },
  { stream_id: "stream-6", creator_username: "pixelpatch", title: "Late-night acoustic set", topic: "chill music", viewer_count: 730 },
  { stream_id: "stream-7", creator_username: "clipnation", title: "Tournament finals watch party", topic: "esports", viewer_count: 2210 },
  { stream_id: "stream-8", creator_username: "walletwiz", title: "Ambient piano session", topic: "chill music", viewer_count: 355 },
];

function buildClusters(): TopicCluster[] {
  const byTopic = new Map<string, ClusterStream[]>();

  for (const { topic, ...stream } of SEED_STREAMS) {
    const existing = byTopic.get(topic) ?? [];
    existing.push(stream);
    byTopic.set(topic, existing);
  }

  const clusters: TopicCluster[] = Array.from(byTopic.entries()).map(([topic, streams]) => ({
    topic,
    streams,
  }));

  clusters.sort((a, b) => {
    const aggregateA = a.streams.reduce((sum, s) => sum + s.viewer_count, 0);
    const aggregateB = b.streams.reduce((sum, s) => sum + s.viewer_count, 0);
    return aggregateB - aggregateA;
  });

  return clusters;
}

export async function GET(req: NextRequest): Promise<NextResponse<ClustersResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);
  const validation = querySchema.safeParse({ viewer_id: searchParams.get("viewer_id") ?? undefined });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid query parameters" },
      { status: 400 },
    );
  }

  return NextResponse.json({ clusters: buildClusters() });
}
