import type { HeatmapBucket } from "./types";
import { clips } from "./seedData";

export const BUCKET_SIZE_SECONDS = 60;

export function buildHeatmap(streamId: string): {
  buckets: HeatmapBucket[];
  peak_minute: number | null;
} {
  const counts = new Map<number, number>();

  for (const clip of clips) {
    if (clip.stream_id !== streamId) {continue;}
    const minuteOffset = Math.floor(clip.offset_seconds / BUCKET_SIZE_SECONDS);
    counts.set(minuteOffset, (counts.get(minuteOffset) ?? 0) + 1);
  }

  const buckets: HeatmapBucket[] = Array.from(counts.entries())
    .map(([minute_offset, clip_count]) => ({ minute_offset, clip_count }))
    .sort((a, b) => a.minute_offset - b.minute_offset);

  let peak_minute: number | null = null;
  let peakCount = 0;
  for (const bucket of buckets) {
    if (bucket.clip_count > peakCount) {
      peakCount = bucket.clip_count;
      peak_minute = bucket.minute_offset;
    }
  }

  return { buckets, peak_minute };
}
