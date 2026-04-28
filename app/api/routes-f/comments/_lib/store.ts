import type { CommentRecord, ThreadedComment } from "./types";

const MAX_COMMENTS = 1000;
const MAX_DEPTH = 6;

const comments = new Map<string, CommentRecord>();
let nextId = 1;

function makeId(): string {
  const id = String(nextId);
  nextId += 1;
  return id;
}

function byCreatedAsc(a: CommentRecord, b: CommentRecord): number {
  return a.created_at.localeCompare(b.created_at) || Number(a.id) - Number(b.id);
}

export function createComment(input: {
  author: string;
  text: string;
  parent_id?: string | null;
}): { ok: true; comment: CommentRecord } | { ok: false; error: string; status: number } {
  if (comments.size >= MAX_COMMENTS) {
    return { ok: false, error: `Comment storage is full (max ${MAX_COMMENTS}).`, status: 507 };
  }

  const parentId = input.parent_id ?? null;
  let depth = 0;

  if (parentId !== null) {
    const parent = comments.get(parentId);
    if (!parent) {
      return { ok: false, error: "parent_id does not exist.", status: 404 };
    }
    if (parent.depth >= MAX_DEPTH) {
      return { ok: false, error: `Maximum reply depth is ${MAX_DEPTH}.`, status: 400 };
    }
    depth = parent.depth + 1;
  }

  const now = new Date().toISOString();
  const comment: CommentRecord = {
    id: makeId(),
    author: input.author,
    text: input.text,
    parent_id: parentId,
    depth,
    created_at: now,
    deleted: false,
  };

  comments.set(comment.id, comment);
  return { ok: true, comment };
}

export function listCommentsFlat(): CommentRecord[] {
  const roots = Array.from(comments.values())
    .filter((comment) => comment.parent_id === null)
    .sort(byCreatedAsc);

  const output: CommentRecord[] = [];
  const walk = (comment: CommentRecord) => {
    output.push(comment);
    const children = Array.from(comments.values())
      .filter((item) => item.parent_id === comment.id)
      .sort(byCreatedAsc);
    for (const child of children) {
      walk(child);
    }
  };

  for (const root of roots) {
    walk(root);
  }

  return output;
}

function toThread(comment: CommentRecord): ThreadedComment {
  const children = Array.from(comments.values())
    .filter((item) => item.parent_id === comment.id)
    .sort(byCreatedAsc)
    .map((child) => toThread(child));

  return {
    ...comment,
    children,
  };
}

export function getThreadById(id: string): ThreadedComment | null {
  const comment = comments.get(id);
  if (!comment) return null;
  return toThread(comment);
}

export function softDeleteComment(id: string): boolean {
  const comment = comments.get(id);
  if (!comment) return false;
  if (comment.deleted) return true;

  comments.set(id, {
    ...comment,
    text: "[deleted]",
    deleted: true,
  });
  return true;
}

export function __resetCommentsStore(): void {
  comments.clear();
  nextId = 1;
}
