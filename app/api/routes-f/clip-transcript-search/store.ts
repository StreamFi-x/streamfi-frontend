import type { ClipSearchResult } from "./types";
import { clipTranscripts } from "./seedData";

export const DEFAULT_LIMIT = 10;
const SNIPPET_RADIUS = 30;

function buildSnippet(text: string, matchIndex: number, queryLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchIndex + queryLength + SNIPPET_RADIUS);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

export function searchClipTranscripts(input: {
  q: string;
  creator_id?: string;
  limit?: number;
}): ClipSearchResult[] {
  const query = input.q.toLowerCase();
  const limit = input.limit ?? DEFAULT_LIMIT;

  const results: ClipSearchResult[] = [];

  for (const transcript of clipTranscripts) {
    if (input.creator_id && transcript.creator_id !== input.creator_id) {
      continue;
    }

    const matchIndex = transcript.text.toLowerCase().indexOf(query);
    if (matchIndex === -1) {continue;}

    results.push({
      clip: transcript.clip_id,
      snippet: buildSnippet(transcript.text, matchIndex, query.length),
      ts: transcript.ts,
    });

    if (results.length >= limit) {break;}
  }

  return results;
}
