import { NextResponse } from 'next/server';
import crypto from 'crypto';

function generateChecksum(key: string): string {
  // basic CRC32 style checksum logic
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < key.length; i++) {
    crc ^= key.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF).toString(16).padStart(8, '0');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { count = 1, prefix = '', length = 32, with_checksum = false } = body;

    count = Math.max(1, Math.min(100, Number(count) || 1));
    length = Math.max(8, Math.min(128, Number(length) || 32));

    const keys = [];

    for (let i = 0; i < count; i++) {
      const entropyBytes = Math.ceil(length / 2);
      let randomPart = crypto.randomBytes(entropyBytes).toString('hex').slice(0, length);
      
      let key = prefix ? `${prefix}_${randomPart}` : randomPart;

      if (with_checksum) {
        const checksum = generateChecksum(key);
        key = `${key}-${checksum}`;
      }

      const fingerprint = crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);

      keys.push({ key, fingerprint });
    }

    return NextResponse.json({ keys });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
