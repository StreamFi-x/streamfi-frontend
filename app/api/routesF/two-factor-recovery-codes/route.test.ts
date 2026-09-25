import { POST as GENERATE } from './generate/route';
import { POST as USE } from './use/route';
import { RECOVERY_CODES } from './store';
import { NextRequest } from 'next/server';

const BASE = 'http://localhost/api/routesF/two-factor-recovery-codes';

function generateReq(body: unknown) {
  return new NextRequest(`${BASE}/generate`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function useReq(body: unknown) {
  return new NextRequest(`${BASE}/use`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('2FA Recovery Codes', () => {
  beforeEach(() => {
    for (const key in RECOVERY_CODES) {
      delete RECOVERY_CODES[key];
    }
  });

  describe('POST /api/routesF/two-factor-recovery-codes/generate', () => {
    it('should generate 10 unique codes by default', async () => {
      const res = await GENERATE(generateReq({ user_id: 'user-1' }));

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.codes).toHaveLength(10);
      expect(new Set(data.codes).size).toBe(10);
      for (const code of data.codes) {
        expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      }
    });

    it('should respect a custom count', async () => {
      const res = await GENERATE(generateReq({ user_id: 'user-1', count: 5 }));
      const data = await res.json();
      expect(data.codes).toHaveLength(5);
    });

    it('should invalidate previous codes when regenerating', async () => {
      const first = await (await GENERATE(generateReq({ user_id: 'user-1' }))).json();
      await GENERATE(generateReq({ user_id: 'user-1' }));

      const res = await USE(useReq({ user_id: 'user-1', code: first.codes[0] }));
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.codes_remaining).toBe(10);
    });

    it('should reject an invalid count', async () => {
      expect((await GENERATE(generateReq({ user_id: 'user-1', count: 0 }))).status).toBe(400);
      expect((await GENERATE(generateReq({ user_id: 'user-1', count: 21 }))).status).toBe(400);
      expect((await GENERATE(generateReq({ user_id: 'user-1', count: 2.5 }))).status).toBe(400);
    });

    it('should return 400 when user_id is missing', async () => {
      const res = await GENERATE(generateReq({}));
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid JSON', async () => {
      const req = new NextRequest(`${BASE}/generate`, { method: 'POST', body: 'not-json' });
      const res = await GENERATE(req);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/routesF/two-factor-recovery-codes/use', () => {
    it('should accept a valid code and decrement codes_remaining', async () => {
      const { codes } = await (await GENERATE(generateReq({ user_id: 'user-1' }))).json();

      const res = await USE(useReq({ user_id: 'user-1', code: codes[0] }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.valid).toBe(true);
      expect(data.codes_remaining).toBe(9);
    });

    it('should invalidate a code once used', async () => {
      const { codes } = await (await GENERATE(generateReq({ user_id: 'user-1' }))).json();

      const first = await (await USE(useReq({ user_id: 'user-1', code: codes[0] }))).json();
      expect(first.valid).toBe(true);

      const second = await (await USE(useReq({ user_id: 'user-1', code: codes[0] }))).json();
      expect(second.valid).toBe(false);
      expect(second.codes_remaining).toBe(9);
    });

    it('should reject an unknown code without changing the remaining count', async () => {
      await GENERATE(generateReq({ user_id: 'user-1' }));

      const res = await USE(useReq({ user_id: 'user-1', code: 'ZZZZ-ZZZZ' }));
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.codes_remaining).toBe(10);
    });

    it('should reject a code for a user with no generated codes', async () => {
      const res = await USE(useReq({ user_id: 'user-none', code: 'ABCD-EFGH' }));
      const data = await res.json();
      expect(data.valid).toBe(false);
      expect(data.codes_remaining).toBe(0);
    });

    it("should not let one user's code work for another user", async () => {
      const { codes } = await (await GENERATE(generateReq({ user_id: 'user-1' }))).json();
      await GENERATE(generateReq({ user_id: 'user-2' }));

      const res = await USE(useReq({ user_id: 'user-2', code: codes[0] }));
      const data = await res.json();
      expect(data.valid).toBe(false);
    });

    it('should return 400 when user_id or code is missing', async () => {
      expect((await USE(useReq({ code: 'ABCD-EFGH' }))).status).toBe(400);
      expect((await USE(useReq({ user_id: 'user-1' }))).status).toBe(400);
    });
  });
});
