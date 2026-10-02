import type { DvrBookmark } from "./types";

let bookmarkIdCounter = 1;

const bookmarks: DvrBookmark[] = [];

export function createBookmark(
  viewerId: string,
  streamId: string,
  timeSeconds: number,
  label?: string
): DvrBookmark {
  const bookmark: DvrBookmark = {
    bookmark_id: `bmk_${String(bookmarkIdCounter++).padStart(6, "0")}`,
    viewer_id: viewerId,
    stream_id: streamId,
    time_seconds: timeSeconds,
    label: label ?? null,
    created_at: new Date().toISOString(),
  };
  bookmarks.push(bookmark);
  return bookmark;
}

export function getBookmarksByViewer(viewerId: string): DvrBookmark[] {
  return bookmarks
    .filter(b => b.viewer_id === viewerId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function deleteBookmark(
  viewerId: string,
  bookmarkId: string
): boolean {
  const idx = bookmarks.findIndex(
    b => b.bookmark_id === bookmarkId && b.viewer_id === viewerId
  );
  if (idx === -1) {
    return false;
  }
  bookmarks.splice(idx, 1);
  return true;
}

export function clearAllBookmarks(): void {
  bookmarks.length = 0;
  bookmarkIdCounter = 1;
}
