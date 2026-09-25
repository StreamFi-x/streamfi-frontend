import { GET, POST } from './route';

function postRequest(body: unknown) {
  return new Request('http://localhost/api/routesF/mod-shift-schedule', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function getRequest(query: string) {
  return new Request(`http://localhost/api/routesF/mod-shift-schedule?${query}`);
}

describe('Mod Shift Schedule API', () => {
  describe('POST', () => {
    it('should return 400 when creator_id is missing', async () => {
      const res = await POST(postRequest({ mod_id: 'm1', day: 'monday', start_time: '09:00', end_time: '10:00' }));
      expect(res.status).toBe(400);
    });

    it('should return 400 for an invalid day', async () => {
      const res = await POST(
        postRequest({ creator_id: 'c1', mod_id: 'm1', day: 'someday', start_time: '09:00', end_time: '10:00' })
      );
      expect(res.status).toBe(400);
    });

    it('should return 400 for a malformed time', async () => {
      const res = await POST(
        postRequest({ creator_id: 'c1', mod_id: 'm1', day: 'monday', start_time: '9am', end_time: '10:00' })
      );
      expect(res.status).toBe(400);
    });

    it('should return 400 when start_time equals end_time', async () => {
      const res = await POST(
        postRequest({ creator_id: 'c1', mod_id: 'm1', day: 'monday', start_time: '09:00', end_time: '09:00' })
      );
      expect(res.status).toBe(400);
    });

    it('should create a shift and return a shift_id', async () => {
      const res = await POST(
        postRequest({ creator_id: 'creator_002', mod_id: 'mod_new', day: 'friday', start_time: '10:00', end_time: '18:00' })
      );
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.shift_id).toBeDefined();
    });

    it('should reject an overlapping shift for the same mod on the same day', async () => {
      const res = await POST(
        postRequest({ creator_id: 'creator_001', mod_id: 'mod_alice', day: 'monday', start_time: '10:00', end_time: '11:00' })
      );
      expect(res.status).toBe(409);
    });

    it('should allow a non-overlapping shift for the same mod on the same day', async () => {
      const res = await POST(
        postRequest({ creator_id: 'creator_001', mod_id: 'mod_alice', day: 'monday', start_time: '18:00', end_time: '20:00' })
      );
      expect(res.status).toBe(201);
    });

    it('should allow overlapping shifts for different mods', async () => {
      const res = await POST(
        postRequest({ creator_id: 'creator_001', mod_id: 'mod_dave', day: 'monday', start_time: '10:00', end_time: '11:00' })
      );
      expect(res.status).toBe(201);
    });
  });

  describe('GET on-duty computation', () => {
    it('should return the mod on duty mid-shift on monday', async () => {
      const res = await GET(getRequest('creator_id=creator_001&at=2023-01-02T12:00:00.000Z'));
      const data = await res.json();
      expect(data.on_duty_mods).toContain('mod_alice');
    });

    it('should exclude a mod before their shift starts', async () => {
      const res = await GET(getRequest('creator_id=creator_001&at=2023-01-02T08:00:00.000Z'));
      const data = await res.json();
      expect(data.on_duty_mods).not.toContain('mod_alice');
    });

    it('should keep a cross-midnight shift active late on its start day', async () => {
      const res = await GET(getRequest('creator_id=creator_001&at=2023-01-02T23:30:00.000Z'));
      const data = await res.json();
      expect(data.on_duty_mods).toContain('mod_bob');
    });

    it('should keep a cross-midnight shift active into the early hours of the next day', async () => {
      const res = await GET(getRequest('creator_id=creator_001&at=2023-01-03T02:00:00.000Z'));
      const data = await res.json();
      expect(data.on_duty_mods).toContain('mod_bob');
      expect(data.on_duty_mods).not.toContain('mod_carol');
    });

    it('should hand off from a cross-midnight shift to the next mod at the boundary', async () => {
      const res = await GET(getRequest('creator_id=creator_001&at=2023-01-03T07:00:00.000Z'));
      const data = await res.json();
      expect(data.on_duty_mods).toContain('mod_carol');
      expect(data.on_duty_mods).not.toContain('mod_bob');
    });

    it('should return 400 when creator_id is missing', async () => {
      const res = await GET(getRequest('at=2023-01-02T12:00:00.000Z'));
      expect(res.status).toBe(400);
    });

    it('should return 400 for an invalid at parameter', async () => {
      const res = await GET(getRequest('creator_id=creator_001&at=not-a-date'));
      expect(res.status).toBe(400);
    });

    it('should return an empty list for a creator with no shifts', async () => {
      const res = await GET(getRequest('creator_id=creator_unknown&at=2023-01-02T12:00:00.000Z'));
      const data = await res.json();
      expect(data.on_duty_mods).toEqual([]);
    });
  });
});
