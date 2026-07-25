import { GET } from './route';

describe('Device Type Breakdown API', () => {
  it('should return 400 when stream_id is missing', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing or invalid stream_id parameter');
  });

  it('should return 400 when stream_id is empty', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown?stream_id=   ');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return empty devices array when stream_id has no viewers', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown?stream_id=stream_999');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.devices).toEqual([]);
  });

  it('should return device breakdown for valid stream_id', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown?stream_id=stream_001');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.devices).toBeDefined();
    expect(Array.isArray(data.devices)).toBe(true);
  });

  it('should have correct device types in response', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    const validTypes = ['desktop', 'mobile', 'tablet', 'tv'];
    data.devices.forEach((device: any) => {
      expect(validTypes).toContain(device.type);
      expect(typeof device.count).toBe('number');
      expect(typeof device.percent).toBe('number');
      expect(device.count).toBeGreaterThan(0);
      expect(device.percent).toBeGreaterThan(0);
      expect(device.percent).toBeLessThanOrEqual(100);
    });
  });

  it('should have percentages summing to 100', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    if (data.devices.length > 0) {
      const totalPercent = data.devices.reduce((sum: number, device: any) => sum + device.percent, 0);
      expect(Math.abs(totalPercent - 100)).toBeLessThan(0.01);
    }
  });

  it('should sort devices by count descending', async () => {
    const req = new Request('http://localhost/api/routesF/device-type-breakdown?stream_id=stream_001');
    const res = await GET(req);
    const data = await res.json();
    for (let i = 1; i < data.devices.length; i++) {
      expect(data.devices[i - 1].count).toBeGreaterThanOrEqual(data.devices[i].count);
    }
  });
});
