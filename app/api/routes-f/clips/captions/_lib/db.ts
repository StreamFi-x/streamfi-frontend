import { sql } from "@vercel/postgres";

export async function ensureCaptionsSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS route_f_clip_captions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clip_id UUID NOT NULL REFERENCES stream_recordings(id) ON DELETE CASCADE,
      language VARCHAR(10) NOT NULL,
      label VARCHAR(255) NOT NULL,
      vtt_content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(clip_id, language)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_route_f_clip_captions_clip
      ON route_f_clip_captions (clip_id)
  `;
}

/**
 * Validates WebVTT content format
 */
export function validateWebVTT(content: string): boolean {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    return false;
  }

  // Must start with WEBVTT
  if (!lines[0].startsWith("WEBVTT")) {
    return false;
  }

  // Check for at least one cue
  let hasCue = false;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Cue timestamp format: HH:MM:SS.mmm --> HH:MM:SS.mmm
    if (line.includes("-->")) {
      hasCue = true;
      break;
    }
  }

  return hasCue;
}

/**
 * Validates BCP-47 language tag
 */
export function validateLanguageTag(tag: string): boolean {
  // Simple BCP-47 validation: language-region format
  // Examples: en, en-US, es, fr-CA
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(tag);
}
