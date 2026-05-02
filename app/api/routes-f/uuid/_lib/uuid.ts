type UUIDVersion = 'v4' | 'v7';

function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function setVersionBits(bytes: Uint8Array, version: number): void {
  bytes[6] = (bytes[6] & 0x0f) | (version << 4);
}

function setVariantBits(bytes: Uint8Array): void {
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
}

function bytesToUUID(bytes: Uint8Array): string {
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function generateUUID(version: UUIDVersion = 'v4'): string {
  const bytes = generateRandomBytes(16);

  if (version === 'v4') {
    setVersionBits(bytes, 4);
  } else if (version === 'v7') {
    const timestamp = Date.now();
    bytes[0] = (timestamp >> 40) & 0xff;
    bytes[1] = (timestamp >> 32) & 0xff;
    bytes[2] = (timestamp >> 24) & 0xff;
    bytes[3] = (timestamp >> 16) & 0xff;
    bytes[4] = (timestamp >> 8) & 0xff;
    bytes[5] = timestamp & 0xff;
    setVersionBits(bytes, 7);
  }

  setVariantBits(bytes);
  return bytesToUUID(bytes);
}

export function generateUUIDs(version: UUIDVersion, count: number): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generateUUID(version));
  }
  return uuids;
}
