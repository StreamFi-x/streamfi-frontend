import type { CoverImageRecord } from "./types";

const covers = new Map<string, CoverImageRecord>();

export function getCover(streamId: string): CoverImageRecord | undefined {
  return covers.get(streamId);
}

export function setCover(streamId: string, coverUrl: string): CoverImageRecord {
  const record: CoverImageRecord = {
    stream_id: streamId,
    cover_url: coverUrl,
    updated_at: new Date().toISOString(),
  };
  covers.set(streamId, record);
  return record;
}

export function clearAllCovers(): void {
  covers.clear();
}
