import { POST } from './route';
import { NextRequest } from 'next/server';

describe('/api/routesF/wrap-search-terms', () => {
  it('wraps multiple terms and handles case insensitivity by default', async () => {
    const req = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello world, hello universe!',
        terms: ['hello', 'world']
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.result).toBe('**Hello** **world**, **hello** universe!');
    expect(json.match_count).toBe(3);
  });

  it('handles case sensitivity when specified', async () => {
    const req = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({
        text: 'Hello world, hello universe!',
        terms: ['hello'],
        case_sensitive: true
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.result).toBe('Hello world, **hello** universe!');
    expect(json.match_count).toBe(1);
  });

  it('avoids overlapping double-wrapping', async () => {
    const req = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({
        text: 'abracadabra',
        terms: ['abrac', 'cadab'],
        marker: '%%'
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.result).toBe('%%abracadab%%ra');
    expect(json.match_count).toBe(2);
  });

  it('handles custom markers', async () => {
    const req = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({
        text: 'apple banana cherry',
        terms: ['banana'],
        marker: '<mark>'
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.result).toBe('apple <mark>banana<mark> cherry');
  });

  it('handles terms completely enclosed by other terms', async () => {
    const req = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({
        text: 'foo bar baz',
        terms: ['foo bar', 'bar'],
        marker: '++'
      })
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.result).toBe('++foo bar++ baz');
    expect(json.match_count).toBe(2);
  });
  
  it('rejects invalid inputs', async () => {
    const req = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({ text: 123, terms: ['test'] })
    });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const req2 = new NextRequest('http://localhost/api/routesF/wrap-search-terms', {
      method: 'POST',
      body: JSON.stringify({ text: 'test', terms: [123] })
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
  });
});
