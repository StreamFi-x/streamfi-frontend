import { describe, it, expect } from '@jest/globals';
import { generateUUID, generateUUIDs } from '../_lib/uuid';
import { GET } from '../route';

describe('UUID Generator', () => {
  describe('generateUUID', () => {
    it('generates valid v4 UUIDs', () => {
      const uuid = generateUUID('v4');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates valid v7 UUIDs', () => {
      const uuid = generateUUID('v7');
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates unique UUIDs for v4', () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID('v4'));
      }
      expect(uuids.size).toBe(100);
    });

    it('generates unique UUIDs for v7', () => {
      const uuids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        uuids.add(generateUUID('v7'));
      }
      expect(uuids.size).toBe(100);
    });

    it('defaults to v4 when no version specified', () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe('4');
    });
  });

  describe('generateUUIDs', () => {
    it('generates correct count of UUIDs for v4', () => {
      expect(generateUUIDs('v4', 3)).toHaveLength(3);
      expect(generateUUIDs('v4', 1)).toHaveLength(1);
      expect(generateUUIDs('v4', 5)).toHaveLength(5);
    });

    it('generates correct count of UUIDs for v7', () => {
      expect(generateUUIDs('v7', 2)).toHaveLength(2);
      expect(generateUUIDs('v7', 10)).toHaveLength(10);
    });

    it('generates empty array for count of 0', () => {
      expect(generateUUIDs('v4', 0)).toHaveLength(0);
    });
  });

  describe('UUID format validation', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it('v4 UUIDs follow correct format', () => {
      const uuid = generateUUID('v4');
      expect(uuid).toMatch(uuidRegex);
      expect(uuid[14]).toBe('4');
    });

    it('v7 UUIDs follow correct format', () => {
      const uuid = generateUUID('v7');
      expect(uuid).toMatch(uuidRegex);
      expect(uuid[14]).toBe('7');
    });
  });
});

describe('GET /api/routes-f/uuid', () => {
  const makeRequest = (search: string = '') =>
    new Request(`http://localhost/api/routes-f/uuid?${search}`);

  it('default request returns 1 v4 UUID', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('uuids');
    expect(Array.isArray(body.uuids)).toBe(true);
    expect(body.uuids).toHaveLength(1);
    expect(body.uuids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('version=v4&count=3 returns 3 v4 UUIDs', async () => {
    const res = await GET(makeRequest('version=v4&count=3'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uuids).toHaveLength(3);
    body.uuids.forEach((uuid: string) => {
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  it('version=v7&count=2 returns 2 v7 UUIDs', async () => {
    const res = await GET(makeRequest('version=v7&count=2'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uuids).toHaveLength(2);
    body.uuids.forEach((uuid: string) => {
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  it('invalid version returns 400', async () => {
    const res = await GET(makeRequest('version=v9'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('count=101 returns 400', async () => {
    const res = await GET(makeRequest('count=101'));
    expect(res.status).toBe(400);
  });

  it('count=0 returns 400', async () => {
    const res = await GET(makeRequest('count=0'));
    expect(res.status).toBe(400);
  });

  it('count=NaN returns 400', async () => {
    const res = await GET(makeRequest('count=NaN'));
    expect(res.status).toBe(400);
  });

  it('negative count returns 400', async () => {
    const res = await GET(makeRequest('count=-5'));
    expect(res.status).toBe(400);
  });

  it('count as non-integer returns 400', async () => {
    const res = await GET(makeRequest('count=2.5'));
    expect(res.status).toBe(400);
  });
});
