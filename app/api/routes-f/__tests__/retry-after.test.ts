/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../retry-after/route';

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/routes-f/retry-after', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/routes-f/retry-after', () => {
  it('parses integer seconds and returns the correct retry_at', async () => {
    const res = await POST(
      makeReq({ header: '120', now: '2026-05-27T12:00:00.000Z' })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      delay_seconds: 120,
      retry_at: '2026-05-27T12:02:00.000Z',
    });
  });

  it('parses an HTTP-date and returns the future delay', async () => {
    const res = await POST(
      makeReq({
        header: 'Fri, 28 May 2026 12:00:00 GMT',
        now: '2026-05-27T12:00:00.000Z',
      })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      delay_seconds: 86400,
      retry_at: '2026-05-28T12:00:00.000Z',
    });
  });

  it('returns zero delay for a past HTTP-date', async () => {
    const res = await POST(
      makeReq({
        header: 'Wed, 27 May 2026 11:00:00 GMT',
        now: '2026-05-27T12:00:00.000Z',
      })
    );
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toEqual({
      delay_seconds: 0,
      retry_at: '2026-05-27T11:00:00.000Z',
    });
  });

  it('rejects malformed retry-after headers', async () => {
    const res = await POST(makeReq({ header: 'not-a-date', now: '2026-05-27T12:00:00.000Z' }));
    expect(res.status).toBe(400);
  });
});
