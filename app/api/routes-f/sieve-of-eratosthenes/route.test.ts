import { GET } from './route';

describe('Sieve of Eratosthenes API', () => {
  it('should return 400 when limit parameter is missing', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when limit is below 2', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=1', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when limit exceeds 1000000', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=1000001', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 400 when limit is not a valid number', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=abc', {
      method: 'GET',
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('should return 25 primes up to 100', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=100', {
      method: 'GET',
    });
    const res = await GET(req);
    const data = await res.json();
    expect(data.count).toBe(25);
    expect(data.primes).toEqual([
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
    ]);
  });

  it('should return correct primes up to 10', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=10', {
      method: 'GET',
    });
    const res = await GET(req);
    const data = await res.json();
    expect(data.count).toBe(4);
    expect(data.primes).toEqual([2, 3, 5, 7]);
  });

  it('should return empty array for limit 2 with 1 prime', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=2', {
      method: 'GET',
    });
    const res = await GET(req);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.primes).toEqual([2]);
  });

  it('should handle large limits efficiently', async () => {
    const req = new Request('http://localhost/api/routes-f/sieve-of-eratosthenes?limit=10000', {
      method: 'GET',
    });
    const res = await GET(req);
    const data = await res.json();
    expect(data.primes[0]).toBe(2);
    expect(data.primes[data.primes.length - 1]).toBe(9973);
    expect(data.count).toBe(1229);
  });
});
