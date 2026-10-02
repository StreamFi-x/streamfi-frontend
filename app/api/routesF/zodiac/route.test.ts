import { GET } from './route';

describe('Zodiac API', () => {
  it('should return 400 if date is missing', async () => {
    const req = new Request('http://localhost/api/routesF/zodiac');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 if date format is invalid', async () => {
    const req = new Request('http://localhost/api/routesF/zodiac?date=01-01-2000');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should identify Capricorn across year boundary', async () => {
    const req1 = new Request('http://localhost/api/routesF/zodiac?date=1990-12-25');
    const res1 = await GET(req1);
    expect(await res1.json()).toEqual({
      sign: 'Capricorn',
      element: 'Earth',
      date_range: 'Dec 22 - Jan 19'
    });

    const req2 = new Request('http://localhost/api/routesF/zodiac?date=1991-01-05');
    const res2 = await GET(req2);
    expect(await res2.json()).toEqual({
      sign: 'Capricorn',
      element: 'Earth',
      date_range: 'Dec 22 - Jan 19'
    });
  });

  it('should identify Aries on cusp boundary', async () => {
    const req1 = new Request('http://localhost/api/routesF/zodiac?date=1990-03-21');
    const res1 = await GET(req1);
    expect((await res1.json()).sign).toBe('Aries');
  });

  it('should return 400 for invalid month/day', async () => {
    const req = new Request('http://localhost/api/routesF/zodiac?date=1990-13-40');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
