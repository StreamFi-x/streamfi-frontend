import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

type CollectionCreator = {
  creator_id: string;
  username: string;
  tagline: string;
};

type CollectionResponse = {
  title: string;
  description: string;
  creators: CollectionCreator[];
};

const querySchema = z.object({
  collection_slug: z.string().min(1, "collection_slug is required"),
});

/** Bundled editorial collections, keyed by slug. */
const COLLECTIONS: Record<string, CollectionResponse> = {
  "best-nigerian-streamers": {
    title: "Best Nigerian Streamers",
    description: "Top-rated creators streaming live from Nigeria across gaming, music, and IRL.",
    creators: [
      { creator_id: "c101", username: "novastreams", tagline: "Ranked esports and speedruns" },
      { creator_id: "c102", username: "pixelpatch", tagline: "Afrobeats and lo-fi live sessions" },
      { creator_id: "c103", username: "walletwiz", tagline: "Crypto talk and market watch parties" },
    ],
  },
  "rising-music-creators": {
    title: "Rising Music Creators",
    description: "Up-and-coming musicians performing live sets and taking song requests.",
    creators: [
      { creator_id: "c201", username: "clipnation", tagline: "Acoustic covers every weeknight" },
      { creator_id: "c202", username: "walletwiz", tagline: "Ambient piano and chill beats" },
    ],
  },
  "top-esports-competitors": {
    title: "Top Esports Competitors",
    description: "Competitive players grinding ranked ladders and scrims.",
    creators: [
      { creator_id: "c301", username: "novastreams", tagline: "Diamond-ranked climb, no filler" },
      { creator_id: "c302", username: "clipnation", tagline: "Tournament prep and VOD review" },
      { creator_id: "c303", username: "pixelpatch", tagline: "Duo queue with viewers welcome" },
    ],
  },
};

export async function GET(req: NextRequest): Promise<NextResponse<CollectionResponse | { error: string }>> {
  const { searchParams } = new URL(req.url);
  const validation = querySchema.safeParse({ collection_slug: searchParams.get("collection_slug") });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid query parameters" },
      { status: 400 },
    );
  }

  const { collection_slug } = validation.data;
  const collection = COLLECTIONS[collection_slug];

  if (!collection) {
    return NextResponse.json({ error: `Unknown collection_slug: ${collection_slug}` }, { status: 404 });
  }

  return NextResponse.json(collection);
}
