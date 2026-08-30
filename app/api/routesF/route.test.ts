/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * @jest-environment node
 */
import { GET, PUT } from './route';
import { NextRequest } from 'next/server';

describe('Creator Merch Links API', () => {
  it('GET should require creator_id', async () => {
    const req = new Request('http://localhost/api/routesF');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('GET should return empty merch_links for unknown creator', async () => {
    const req = new Request('http://localhost/api/routesF?creator_id=new_creator');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.merch_links).toEqual([]);
  });

  it('PUT should enforce cap of 5 links', async () => {
    const putReq = new Request('http://localhost/api/routesF', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_id: 'creator_1',
        merch_links: [
          { label: 'Link 1', url: 'https://test.com/1' },
          { label: 'Link 2', url: 'https://test.com/2' },
          { label: 'Link 3', url: 'https://test.com/3' },
          { label: 'Link 4', url: 'https://test.com/4' },
          { label: 'Link 5', url: 'https://test.com/5' },
          { label: 'Link 6', url: 'https://test.com/6' },
        ]
      })
    });
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(400);
    const data = await putRes.json();
    expect(data.error).toBe('Maximum of 5 merch links allowed');
  });

  it('PUT should validate URLs', async () => {
    const putReq = new Request('http://localhost/api/routesF', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_id: 'creator_2',
        merch_links: [
          { label: 'Invalid Link', url: 'not-a-url' }
        ]
      })
    });
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(400);
    const data = await putRes.json();
    expect(data.error).toMatch(/Invalid URL/);
  });

  it('PUT should update merch links and GET should retrieve them', async () => {
    const putReq = new Request('http://localhost/api/routesF', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creator_id: 'creator_3',
        merch_links: [
          { label: 'Shopify', url: 'https://shopify.com/mystore' },
          { label: 'Etsy', url: 'https://etsy.com/shop/mystore' }
        ]
      })
    });
    const putRes = await PUT(putReq);
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.merch_links.length).toBe(2);

    const getReq = new Request('http://localhost/api/routesF?creator_id=creator_3');
    const getRes = await GET(getReq);
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.merch_links.length).toBe(2);
    expect(getData.merch_links[0].label).toBe('Shopify');
    expect(getData.merch_links[0].url).toBe('https://shopify.com/mystore');
  });
});
