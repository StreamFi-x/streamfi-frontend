import { BlockRecord } from "./types";

// Key: `${blocker_id}:${blocked_id}`
export const blockStore = new Map<string, BlockRecord>();

export function blockKey(blocker_id: string, blocked_id: string) {
  return `${blocker_id}:${blocked_id}`;
}

export function _resetStore() {
  blockStore.clear();
}
