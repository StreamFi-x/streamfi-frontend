import { NextRequest } from 'next/server';
import { POST } from './route';
import { __resetQuietHoursStore, setConfig } from '../store';

const BASE = 'http://localhost/api/routesF/quiet-hours-notification-config/check-quiet';

function makePost(body: unknown) {
  return new NextRequest(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /quiet-hours-notification-config/check-quiet', () => {
  beforeEach(() => {
    __resetQuietHoursStore();
  });

  it('returns false for a viewer with no config (disabled by default)', async () => {
    const res = await POST(makePost({ viewer_id: 'v1', at: '2026-01-15T23:00:00Z' }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ in_quiet_hours: false });
  });

  it('returns true for an instant inside a cross-midnight quiet window', async () => {
    setConfig('v1', { start_hour: 22, end_hour: 8, timezone: 'UTC', enabled: true });

    const res = await POST(makePost({ viewer_id: 'v1', at: '2026-01-15T23:30:00Z' }));
    expect((await res.json()).in_quiet_hours).toBe(true);
  });

  it('returns true for an instant just after midnight, still inside the cross-midnight window', async () => {
    setConfig('v1', { start_hour: 22, end_hour: 8, timezone: 'UTC', enabled: true });

    const res = await POST(makePost({ viewer_id: 'v1', at: '2026-01-16T01:00:00Z' }));
    expect((await res.json()).in_quiet_hours).toBe(true);
  });

  it('returns false for an instant outside a cross-midnight quiet window', async () => {
    setConfig('v1', { start_hour: 22, end_hour: 8, timezone: 'UTC', enabled: true });

    const res = await POST(makePost({ viewer_id: 'v1', at: '2026-01-15T14:00:00Z' }));
    expect((await res.json()).in_quiet_hours).toBe(false);
  });

  it('respects the configured timezone, not the raw UTC hour', async () => {
    // 14:00 UTC = 23:00 in Tokyo (UTC+9, no DST) -> inside a 22->8 window.
    setConfig('v1', { start_hour: 22, end_hour: 8, timezone: 'Asia/Tokyo', enabled: true });

    const res = await POST(makePost({ viewer_id: 'v1', at: '2026-01-15T14:00:00Z' }));
    expect((await res.json()).in_quiet_hours).toBe(true);
  });

  it('gives a different answer for the same instant under UTC vs. a shifted timezone', async () => {
    const at = '2026-01-15T14:00:00Z';
    setConfig('utc-viewer', { start_hour: 22, end_hour: 8, timezone: 'UTC', enabled: true });
    setConfig('tokyo-viewer', { start_hour: 22, end_hour: 8, timezone: 'Asia/Tokyo', enabled: true });

    const utcRes = await POST(makePost({ viewer_id: 'utc-viewer', at }));
    const tokyoRes = await POST(makePost({ viewer_id: 'tokyo-viewer', at }));

    expect((await utcRes.json()).in_quiet_hours).toBe(false); // 14:00 UTC -> not quiet
    expect((await tokyoRes.json()).in_quiet_hours).toBe(true); // 23:00 JST -> quiet
  });

  it('defaults `at` to the current time when omitted', async () => {
    setConfig('v1', { start_hour: 0, end_hour: 23, timezone: 'UTC', enabled: false });
    const res = await POST(makePost({ viewer_id: 'v1' }));
    expect(res.status).toBe(200);
    expect(typeof (await res.json()).in_quiet_hours).toBe('boolean');
  });

  it('returns false regardless of the window when the config is disabled', async () => {
    setConfig('v1', { start_hour: 22, end_hour: 8, timezone: 'UTC', enabled: false });

    const res = await POST(makePost({ viewer_id: 'v1', at: '2026-01-15T23:30:00Z' }));
    expect((await res.json()).in_quiet_hours).toBe(false);
  });

  it('returns 400 when viewer_id is missing', async () => {
    const res = await POST(makePost({ at: '2026-01-15T23:30:00Z' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed `at` timestamp', async () => {
    const res = await POST(makePost({ viewer_id: 'v1', at: 'not-a-date' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const req = new NextRequest(BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{broken',
    });
    expect((await POST(req)).status).toBe(400);
  });
});
