import { GET } from './route';

describe('Project Codename Generator API', () => {
  it('should return 400 if parameters are missing', async () => {
    const req = new Request('http://localhost/api/routesF/project-codename');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should generate codenames deterministically', async () => {
    const req1 = new Request('http://localhost/api/routesF/project-codename?count=3&seed=42&theme=animals');
    const res1 = await GET(req1);
    const data1 = await res1.json();

    const req2 = new Request('http://localhost/api/routesF/project-codename?count=3&seed=42&theme=animals');
    const res2 = await GET(req2);
    const data2 = await res2.json();

    expect(data1.codenames).toEqual(data2.codenames);
    expect(data1.codenames).toHaveLength(3);
    expect(data1.codenames[0]).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('should support the "any" theme', async () => {
    const req = new Request('http://localhost/api/routesF/project-codename?count=5&seed=123&theme=any');
    const res = await GET(req);
    const data = await res.json();
    expect(data.codenames).toHaveLength(5);
  });

  it('should return 400 for invalid theme', async () => {
    const req = new Request('http://localhost/api/routesF/project-codename?count=1&seed=1&theme=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
