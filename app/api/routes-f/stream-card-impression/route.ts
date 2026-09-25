/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";

export type ImpressionSource = "explore" | "category" | "search";

export interface SourceData {
  impressions: number;
  clicks: number;
}

export interface StreamMetrics {
  impressions: number;
  clicks: number;
  sources: Record<ImpressionSource, SourceData>;
}

// In-memory store for impression and click tracking
const store = new Map<string, StreamMetrics>();

// Seed some initial data for testing/demo
function getOrCreateStream(streamId: string): StreamMetrics {
  if (!store.has(streamId)) {
    store.set(streamId, {
      impressions: 0,
      clicks: 0,
      sources: {
        explore: { impressions: 0, clicks: 0 },
        category: { impressions: 0, clicks: 0 },
        search: { impressions: 0, clicks: 0 },
      },
    });
  }
  return store.get(streamId)!;
}

export function recordImpression(streamId: string, source: ImpressionSource) {
  const data = getOrCreateStream(streamId);
  data.impressions += 1;
  if (!data.sources[source]) {
    data.sources[source] = { impressions: 0, clicks: 0 };
  }
  data.sources[source].impressions += 1;
  return data;
}

export function recordClick(streamId: string, source: ImpressionSource) {
  const data = getOrCreateStream(streamId);
  data.clicks += 1;
  if (!data.sources[source]) {
    data.sources[source] = { impressions: 0, clicks: 0 };
  }
  data.sources[source].clicks += 1;
  return data;
}

export function getStreamStats(streamId: string) {
  const data = getOrCreateStream(streamId);
  const computeCtr = (clicks: number, impressions: number): number => {
    if (impressions <= 0) {return 0;}
    return Number(((clicks / impressions) * 100).toFixed(2));
  };

  return {
    stream_id: streamId,
    impressions: data.impressions,
    clicks: data.clicks,
    ctr_percent: computeCtr(data.clicks, data.impressions),
    by_source: {
      explore: {
        impressions: data.sources.explore.impressions,
        clicks: data.sources.explore.clicks,
        ctr_percent: computeCtr(
          data.sources.explore.clicks,
          data.sources.explore.impressions
        ),
      },
      category: {
        impressions: data.sources.category.impressions,
        clicks: data.sources.category.clicks,
        ctr_percent: computeCtr(
          data.sources.category.clicks,
          data.sources.category.impressions
        ),
      },
      search: {
        impressions: data.sources.search.impressions,
        clicks: data.sources.search.clicks,
        ctr_percent: computeCtr(
          data.sources.search.clicks,
          data.sources.search.impressions
        ),
      },
    },
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const streamId = url.searchParams.get("stream_id");

  if (!streamId) {
    return NextResponse.json(
      { error: "stream_id is required" },
      { status: 400 }
    );
  }

  return NextResponse.json(getStreamStats(streamId), { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { stream_id, source, action } = body;

    if (!stream_id) {
      return NextResponse.json(
        { error: "stream_id is required" },
        { status: 400 }
      );
    }

    if (!source || !["explore", "category", "search"].includes(source)) {
      return NextResponse.json(
        { error: "source must be one of: explore, category, search" },
        { status: 400 }
      );
    }

    if (action === "click" || req.url.includes("/click")) {
      recordClick(stream_id, source as ImpressionSource);
      return NextResponse.json({
        success: true,
        action: "click",
        stream_id,
        source,
        stats: getStreamStats(stream_id),
      });
    } else {
      recordImpression(stream_id, source as ImpressionSource);
      return NextResponse.json({
        success: true,
        action: "impression",
        stream_id,
        source,
        stats: getStreamStats(stream_id),
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
