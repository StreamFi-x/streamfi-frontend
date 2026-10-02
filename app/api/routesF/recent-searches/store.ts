export type SearchHistory = {
  viewer_id: string;
  query: string;
  timestamp: number;
};

// In-memory store
export const searchStore = new Map<string, SearchHistory[]>();

export const MAX_HISTORY_PER_VIEWER = 50;

export function recordSearch(viewer_id: string, query: string) {
  if (!searchStore.has(viewer_id)) {
    searchStore.set(viewer_id, []);
  }

  const history = searchStore.get(viewer_id)!;
  
  // Dedup: remove existing if matches query
  const existingIndex = history.findIndex(h => h.query === query);
  if (existingIndex !== -1) {
    history.splice(existingIndex, 1);
  }

  // Add to front
  history.unshift({ viewer_id, query, timestamp: Date.now() });

  // Cap at 50
  if (history.length > MAX_HISTORY_PER_VIEWER) {
    history.length = MAX_HISTORY_PER_VIEWER; // Truncate
  }
}

export function getRecentSearches(viewer_id: string, limit: number = 10) {
  const history = searchStore.get(viewer_id) || [];
  return history.slice(0, limit);
}

export function clearHistory(viewer_id: string) {
  searchStore.delete(viewer_id);
}
