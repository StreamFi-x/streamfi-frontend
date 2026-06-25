import type { TimestampComment, VodRecord } from "./types";

let commentIdCounter = 1;

// Seed VOD records so we can validate time_seconds against duration
export const vodStore: VodRecord[] = [
  {
    vod_id: "vod_a1",
    creator_id: "creator_a",
    title: "Epic Gameplay Session",
    duration_seconds: 7200,
    created_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    vod_id: "vod_a2",
    creator_id: "creator_a",
    title: "World Record Attempt",
    duration_seconds: 3600,
    created_at: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    vod_id: "vod_b1",
    creator_id: "creator_b",
    title: "Tip Milestone Stream",
    duration_seconds: 5400,
    created_at: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    vod_id: "vod_c1",
    creator_id: "creator_c",
    title: "Blockchain Tutorial",
    duration_seconds: 2700,
    created_at: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
];

// Pre-seed some comments for testing
export const commentStore: TimestampComment[] = [
  {
    comment_id: "cmt_001",
    vod_id: "vod_a1",
    user_id: "viewer_alice",
    text: "This play was insane!",
    time_seconds: 120,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    comment_id: "cmt_002",
    vod_id: "vod_a1",
    user_id: "viewer_bob",
    text: "Best moment of the stream right here",
    time_seconds: 125,
    created_at: new Date(Date.now() - 3000000).toISOString(),
  },
  {
    comment_id: "cmt_003",
    vod_id: "vod_a1",
    user_id: "viewer_charlie",
    text: "The setup at this timestamp is perfect",
    time_seconds: 300,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    comment_id: "cmt_004",
    vod_id: "vod_a1",
    user_id: "viewer_diana",
    text: "Stream starting to heat up",
    time_seconds: 600,
    created_at: new Date(Date.now() - 900000).toISOString(),
  },
  {
    comment_id: "cmt_005",
    vod_id: "vod_b1",
    user_id: "viewer_eve",
    text: "That XLM tip drop was legendary",
    time_seconds: 1800,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

export function findVod(vodId: string): VodRecord | undefined {
  return vodStore.find(v => v.vod_id === vodId);
}

export function addComment(comment: Omit<TimestampComment, "comment_id" | "created_at">): TimestampComment {
  const newComment: TimestampComment = {
    ...comment,
    comment_id: `cmt_${String(commentIdCounter++).padStart(3, "0")}`,
    created_at: new Date().toISOString(),
  };
  commentStore.push(newComment);
  return newComment;
}

export function getCommentsByVod(vodId: string): TimestampComment[] {
  return commentStore.filter(c => c.vod_id === vodId);
}
