export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateTag(tag: string): boolean {
  return tag.length > 0 && tag.length <= 50 && /^[a-z0-9-]+$/.test(tag);
}

export const streamTagsStore = new Map<string, string[]>();

export function getStreamTags(streamId: string): string[] {
  return streamTagsStore.get(streamId) || [];
}

export function setStreamTags(streamId: string, tags: string[]): void {
  streamTagsStore.set(streamId, tags);
}

export function updateStreamTags(
  streamId: string,
  add?: string[],
  remove?: string[]
): { tags: string[]; error?: string } {
  const currentTags = getStreamTags(streamId);
  const normalizedAdd = (add || []).map(normalizeTag).filter(validateTag);
  const normalizedRemove = (remove || []).map(normalizeTag).filter(validateTag);

  let newTags = [...currentTags];

  // Remove tags first
  newTags = newTags.filter(tag => !normalizedRemove.includes(tag));

  // Add new tags (dedup)
  normalizedAdd.forEach(tag => {
    if (!newTags.includes(tag)) {
      newTags.push(tag);
    }
  });

  // Cap at 10
  if (newTags.length > 10) {
    return { tags: currentTags, error: 'Maximum 10 tags allowed' };
  }

  setStreamTags(streamId, newTags);
  return { tags: newTags };
}
