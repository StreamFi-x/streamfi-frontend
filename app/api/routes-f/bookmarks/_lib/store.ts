import type { Bookmark, SortField } from "./types";

const MAX_BOOKMARKS = 1000;
const bookmarks = new Map<string, Bookmark>();

function makeId(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function listBookmarks(tag?: string, q?: string, sort: SortField = "created"): Bookmark[] {
  let items = Array.from(bookmarks.values());

  if (tag) items = items.filter((b) => b.tags.includes(tag));

  if (q) {
    const lower = q.toLowerCase();
    items = items.filter(
      (b) =>
        b.title.toLowerCase().includes(lower) ||
        (b.description ?? "").toLowerCase().includes(lower)
    );
  }

  return sort === "title"
    ? items.sort((a, b) => a.title.localeCompare(b.title))
    : items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getBookmark(id: string): Bookmark | undefined {
  return bookmarks.get(id);
}

export function createBookmark(data: {
  url: string;
  title: string;
  description?: string;
  tags?: string[];
}): Bookmark | null {
  if (bookmarks.size >= MAX_BOOKMARKS) return null;
  const now = new Date().toISOString();
  const bookmark: Bookmark = {
    id: makeId(),
    url: data.url,
    title: data.title,
    description: data.description,
    tags: data.tags ?? [],
    created_at: now,
    updated_at: now,
  };
  bookmarks.set(bookmark.id, bookmark);
  return bookmark;
}

export function updateBookmark(
  id: string,
  data: Partial<Pick<Bookmark, "url" | "title" | "description" | "tags">>
): Bookmark | null {
  const existing = bookmarks.get(id);
  if (!existing) return null;
  const updated: Bookmark = { ...existing, ...data, updated_at: new Date().toISOString() };
  bookmarks.set(id, updated);
  return updated;
}

export function deleteBookmark(id: string): boolean {
  return bookmarks.delete(id);
}

export function _clear(): void {
  bookmarks.clear();
}
