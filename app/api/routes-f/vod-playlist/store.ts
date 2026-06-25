import type { ViewerPlaylist, PlaylistItem } from "./types";

const MAX_PLAYLIST_ITEMS = 100;

const playlists = new Map<string, PlaylistItem[]>();

export function getPlaylist(viewerId: string): ViewerPlaylist {
  const items = playlists.get(viewerId) ?? [];
  return { viewer_id: viewerId, items: [...items] };
}

export function appendToPlaylist(viewerId: string, vodId: string): PlaylistItem {
  const items = playlists.get(viewerId) ?? [];

  if (items.length >= MAX_PLAYLIST_ITEMS) {
    throw new Error("Playlist is full (max 100 items)");
  }

  const existing = items.find(i => i.vod_id === vodId);
  if (existing) {
    throw new Error("VOD already in playlist");
  }

  const item: PlaylistItem = {
    vod_id: vodId,
    added_at: new Date().toISOString(),
  };
  items.push(item);
  playlists.set(viewerId, items);
  return item;
}

export function removeFromPlaylist(viewerId: string, vodId: string): boolean {
  const items = playlists.get(viewerId);
  if (!items) {
    return false;
  }

  const idx = items.findIndex(i => i.vod_id === vodId);
  if (idx === -1) {
    return false;
  }

  items.splice(idx, 1);
  playlists.set(viewerId, items);
  return true;
}

export function reorderPlaylist(viewerId: string, order: string[]): void {
  const items = playlists.get(viewerId);
  if (!items) {
    throw new Error("No playlist found for viewer");
  }

  const itemMap = new Map(items.map(i => [i.vod_id, i]));
  const reordered: PlaylistItem[] = [];

  for (const vodId of order) {
    const item = itemMap.get(vodId);
    if (!item) {
      throw new Error(`vod_id '${vodId}' not found in playlist`);
    }
    reordered.push(item);
  }

  if (reordered.length !== items.length) {
    throw new Error("Reorder list does not contain all playlist items");
  }

  playlists.set(viewerId, reordered);
}

export function clearAllPlaylists(): void {
  playlists.clear();
}
