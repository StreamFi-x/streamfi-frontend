import { NextRequest, NextResponse } from 'next/server';

// Only these request headers are echoed back, to avoid reflecting
// authorization tokens or cookies
export const HEADER_ALLOW_LIST = [
  'content-type',
  'user-agent',
  'accept',
  'accept-language',
  'x-request-id',
];

export const MAX_PAYLOAD_BYTES = 100 * 1024; // 100KB

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (Buffer.byteLength(raw, 'utf8') > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: `Payload exceeds ${MAX_PAYLOAD_BYTES} bytes` },
      { status: 413 }
    );
  }

  let received: unknown;
  try {
    received = raw.length === 0 ? null : JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  for (const name of HEADER_ALLOW_LIST) {
    const value = req.headers.get(name);
    if (value !== null) {
      headers[name] = value;
    }
  }

  return NextResponse.json({
    received,
    headers,
    timestamp: new Date().toISOString(),
  });
}
