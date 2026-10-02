import { POST } from './route';

describe('Luhn API', () => {
  it('should return 400 for invalid body', async () => {
    const req = new Request('http://localhost/api/routesF/luhn', {
      method: 'POST',
      body: JSON.stringify({ mode: 'generate' })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should generate check digit correctly', async () => {
    const req = new Request('http://localhost/api/routesF/luhn', {
      method: 'POST',
      body: JSON.stringify({ number: '7992739871', mode: 'generate' })
    });
    const res = await POST(req);
    const data = await res.json();
    expect(data.number).toBe('79927398713');
    expect(data.checkDigit).toBe(3);
  });

  it('should validate correctly', async () => {
    const req1 = new Request('http://localhost/api/routesF/luhn', {
      method: 'POST',
      body: JSON.stringify({ number: '79927398713', mode: 'validate' })
    });
    const res1 = await POST(req1);
    expect((await res1.json()).valid).toBe(true);

    const req2 = new Request('http://localhost/api/routesF/luhn', {
      method: 'POST',
      body: JSON.stringify({ number: '79927398714', mode: 'validate' })
    });
    const res2 = await POST(req2);
    expect((await res2.json()).valid).toBe(false);
  });
});
