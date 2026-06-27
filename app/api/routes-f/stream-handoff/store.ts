import type { HandoffEntry, StreamRecord } from "./types";

/**
 * In-memory stream + handoff log store.
 *
 * `streams` tracks the current host and the allowed hosts list for each
 * stream. `handoffLog` keeps an append-only history of every handoff, keyed by
 * stream_id. State lives only for the lifetime of the process.
 */
const streams = new Map<string, StreamRecord>();
const handoffLog = new Map<string, HandoffEntry[]>();

export function __resetHandoffStore(): void {
  streams.clear();
  handoffLog.clear();
}

export function upsertStream(record: StreamRecord): StreamRecord {
  const normalized: StreamRecord = {
    stream_id: record.stream_id,
    current_host_id: record.current_host_id,
    hosts: Array.from(new Set([record.current_host_id, ...record.hosts])),
  };
  streams.set(record.stream_id, normalized);
  return normalized;
}

export function getStream(streamId: string): StreamRecord | undefined {
  return streams.get(streamId);
}

export function getHandoffLog(streamId: string): HandoffEntry[] {
  return handoffLog.get(streamId) ?? [];
}

/**
 * Apply a handoff: re-point the stream's current host and append a log entry.
 * Caller is responsible for authorisation and target validation.
 */
export function applyHandoff(
  streamId: string,
  fromUserId: string,
  toUserId: string
): HandoffEntry {
  const stream = streams.get(streamId);
  if (!stream) {
    throw new Error(`unknown stream_id: ${streamId}`);
  }
  stream.current_host_id = toUserId;
  if (!stream.hosts.includes(toUserId)) {
    stream.hosts.push(toUserId);
  }
  const entry: HandoffEntry = {
    stream_id: streamId,
    from_user_id: fromUserId,
    to_user_id: toUserId,
    handed_off_at: new Date().toISOString(),
  };
  const existing = handoffLog.get(streamId) ?? [];
  existing.push(entry);
  handoffLog.set(streamId, existing);
  return entry;
}
