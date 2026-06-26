import type { ChannelAbout } from "./types";

const aboutPages = new Map<string, ChannelAbout>();

export function getAbout(creatorId: string): ChannelAbout | null {
  return aboutPages.get(creatorId) ?? null;
}

export function upsertAbout(
  creatorId: string,
  aboutMarkdown: string
): ChannelAbout {
  const now = new Date().toISOString();
  const record: ChannelAbout = {
    creator_id: creatorId,
    about_markdown: aboutMarkdown,
    last_updated: now,
  };
  aboutPages.set(creatorId, record);
  return record;
}

export function clearAllAboutPages(): void {
  aboutPages.clear();
}

export function byteLength(content: string): number {
  return new TextEncoder().encode(content).length;
}
