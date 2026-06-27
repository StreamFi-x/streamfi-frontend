import { getStore } from "./store";

export function markById(viewerId: string, ids: string[]): number {
  const store = getStore();
  let count = 0;
  for (const n of store) {
    if (n.viewer_id === viewerId && ids.includes(n.id) && !n.read) {
      n.read = true;
      count++;
    }
  }
  return count;
}

export function markAll(viewerId: string): number {
  const store = getStore();
  let count = 0;
  for (const n of store) {
    if (n.viewer_id === viewerId && !n.read) {
      n.read = true;
      count++;
    }
  }
  return count;
}
