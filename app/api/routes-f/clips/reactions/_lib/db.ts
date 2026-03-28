import { sql } from "@vercel/postgres";

export const REACTION_EMOJIS = [
  "🔥",
  "❤️",
  "😂",
  "👏",
  "💜",
  "😮",
  "💯",
  "🎉",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export async function ensureClipReactionSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_clip_reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (clip_id, user_id, emoji)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_clip_reactions_clip
      ON route_f_clip_reactions (clip_id, created_at DESC)
  `;
}
