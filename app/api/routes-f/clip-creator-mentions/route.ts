import { NextRequest, NextResponse } from "next/server";

// Known creators bundled per the routes-f scope constraint, used to validate
// @-mentions extracted from a clip's title/description.
export const KNOWN_CREATORS = [
  "novastreams",
  "pixelpatch",
  "walletwiz",
  "raidmaster",
  "clutchqueen",
];

// Maps seed clip_ids to their owning creator, so a mention of the clip's own
// creator can be skipped even though the request body doesn't carry
// creator_id directly.
export const SEED_CLIP_OWNERS: Record<string, string> = {
  "clip-1": "novastreams",
  "clip-2": "pixelpatch",
  "clip-3": "walletwiz",
};

const MENTION_PATTERN = /@([a-z0-9_]+)/gi;

function extractMentions(text: string): string[] {
  const matches = text.matchAll(MENTION_PATTERN);
  const found = new Set<string>();
  for (const match of matches) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || typeof body.clip_id !== "string" || !body.clip_id.trim()) {
    return NextResponse.json({ error: "clip_id is required" }, { status: 400 });
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description : "";
  const combinedText = `${body.title} ${description}`;

  const ownerCreatorId = SEED_CLIP_OWNERS[body.clip_id] ?? null;

  const mentions = extractMentions(combinedText)
    .filter((handle) => KNOWN_CREATORS.includes(handle))
    .filter((handle) => handle !== ownerCreatorId);

  return NextResponse.json({ mentions });
}
