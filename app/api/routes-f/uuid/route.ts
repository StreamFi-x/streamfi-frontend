import { generateUUIDs } from './_lib/uuid';

export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const versionParam = url.searchParams.get('version') || 'v4';
  const countParam = url.searchParams.get('count') || '1';

  const validVersions = ['v4', 'v7'];
  if (!validVersions.includes(versionParam)) {
    return new Response(JSON.stringify({ error: 'Invalid version. Must be v4 or v7.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const count = Number(countParam);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return new Response(
      JSON.stringify({ error: 'Count must be an integer between 1 and 100.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const version = versionParam as 'v4' | 'v7';
  const uuids = generateUUIDs(version, count);

  return new Response(JSON.stringify({ uuids }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
