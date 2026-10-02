export interface ColorTag {
  streamId: string;
  colorHex: string;
  createdAt: string;
}

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const seedColorTags: Map<string, ColorTag> = new Map([
  [
    'stream-1',
    { streamId: 'stream-1', colorHex: '#FF5733', createdAt: '2026-07-20T10:00:00Z' },
  ],
  [
    'stream-2',
    { streamId: 'stream-2', colorHex: '#33FF57', createdAt: '2026-07-21T14:30:00Z' },
  ],
  [
    'stream-3',
    { streamId: 'stream-3', colorHex: '#3357FF', createdAt: '2026-07-22T09:15:00Z' },
  ],
]);

export function getColorTag(streamId: string): ColorTag | null {
  return seedColorTags.get(streamId) ?? null;
}

export function setColorTag(streamId: string, colorHex: string): ColorTag {
  const tag: ColorTag = {
    streamId,
    colorHex,
    createdAt: new Date().toISOString(),
  };
  seedColorTags.set(streamId, tag);
  return tag;
}

export function deleteColorTag(streamId: string): boolean {
  return seedColorTags.delete(streamId);
}

export function isValidHexColor(color: string): boolean {
  return HEX_COLOR_REGEX.test(color);
}