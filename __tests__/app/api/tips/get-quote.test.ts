/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';

const mockSql = jest.fn();
const mockFetch = jest.fn();

jest.mock('@vercel/postgres', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

// Mock global fetch
global.fetch = mockFetch as any;

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';

let POST: (req: NextRequest) => Promise<NextResponse>;
let GET: (req: NextRequest) => Promise<NextResponse>;

const CREATOR_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_RATE = 0.45;

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/tips/get-quote', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSql.mockReset();
  mockFetch.mockReset();
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('../../../app/api/tips/get-quote/route');
    POST = module.POST;
    GET = module.GET;
  });
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/tips/get-quote', () => {
  it('creates a quote with valid input', async () => {
    const quoteId = '550e8400-e29b-41d4-a716-446655440111';
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ price: VALID_RATE }), { status: 200 })
    );
    mockSql.mockResolvedValueOnce({
      rows: [{ id: quoteId }],
    });

    const res = await POST(
      createRequest({
        fiat_amount_cents: 500, // $5.00
        creator_id: CREATOR_ID,
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.quote_token).toBeDefined();
    expect(data.quote_token).toHaveLength(64); // 32 bytes = 64 hex chars
    expect(data.quoted_rate).toBe(VALID_RATE);
    expect(data.quoted_xlm_amount).toBe(parseFloat((5.0 / VALID_RATE).toFixed(7)));
    expect(data.fiat_amount_cents).toBe(500);
    expect(data.expires_at).toBeDefined();
    expect(data.ttl_seconds).toBe(300);
    expect(data.quote_id).toBe(quoteId);
  });

  it('rejects missing fiat_amount_cents', async () => {
    const res = await POST(
      createRequest({
        creator_id: CREATOR_ID,
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request body');
    expect(data.details).toContainEqual(
      expect.objectContaining({ field: 'fiat_amount_cents' })
    );
  });

  it('rejects missing creator_id', async () => {
    const res = await POST(
      createRequest({
        fiat_amount_cents: 500,
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request body');
    expect(data.details).toContainEqual(
      expect.objectContaining({ field: 'creator_id' })
    );
  });

  it('rejects zero fiat amount', async () => {
    const res = await POST(
      createRequest({
        fiat_amount_cents: 0,
        creator_id: CREATOR_ID,
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('rejects negative fiat amount', async () => {
    const res = await POST(
      createRequest({
        fiat_amount_cents: -100,
        creator_id: CREATOR_ID,
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('rejects invalid creator_id', async () => {
    const res = await POST(
      createRequest({
        fiat_amount_cents: 500,
        creator_id: 'not-a-uuid',
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid request body');
  });

  it('handles price fetch failure with 500 error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
      })
    );

    const res = await POST(
      createRequest({
        fiat_amount_cents: 500,
        creator_id: CREATOR_ID,
      })
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to fetch exchange rate');
  });

  it('handles database insertion failure with 500 error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ price: VALID_RATE }), { status: 200 })
    );
    mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

    const res = await POST(
      createRequest({
        fiat_amount_cents: 500,
        creator_id: CREATOR_ID,
      })
    );

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to create quote');
  });

  it('generates unique tokens for consecutive requests', async () => {
    const quoteId1 = '550e8400-e29b-41d4-a716-446655440111';
    const quoteId2 = '550e8400-e29b-41d4-a716-446655440222';

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ price: VALID_RATE }), { status: 200 })
    );

    mockSql.mockResolvedValueOnce({ rows: [{ id: quoteId1 }] });

    const res1 = await POST(
      createRequest({
        fiat_amount_cents: 500,
        creator_id: CREATOR_ID,
      })
    );
    const data1 = await res1.json();

    mockSql.mockResolvedValueOnce({ rows: [{ id: quoteId2 }] });

    const res2 = await POST(
      createRequest({
        fiat_amount_cents: 500,
        creator_id: CREATOR_ID,
      })
    );
    const data2 = await res2.json();

    expect(data1.quote_token).not.toBe(data2.quote_token);
  });

  it('computes correct XLM amount with different rates', async () => {
    const testCases = [
      { fiatCents: 100, rate: 0.5, expectedXlm: 0.2 }, // $1 / 0.5 = 2 XLM
      { fiatCents: 1000, rate: 0.1, expectedXlm: 100 }, // $10 / 0.1 = 100 XLM
      { fiatCents: 472, rate: 0.45, expectedXlm: (4.72 / 0.45).toFixed(7) },
    ];

    for (const testCase of testCases) {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ price: testCase.rate }), { status: 200 })
      );
      mockSql.mockResolvedValueOnce({
        rows: [{ id: `550e8400-e29b-41d4-a716-44665544${testCases.indexOf(testCase)}` }],
      });

      const res = await POST(
        createRequest({
          fiat_amount_cents: testCase.fiatCents,
          creator_id: CREATOR_ID,
        })
      );

      const data = await res.json();
      expect(data.quoted_xlm_amount).toBe(parseFloat(testCase.expectedXlm as any));
    }
  });

  it('returns 405 for GET requests', async () => {
    const req = new NextRequest('http://localhost/api/tips/get-quote', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(405);
    const data = await res.json();
    expect(data.error).toBe('Method not allowed');
  });

  it('includes trace id in response headers', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ price: VALID_RATE }), { status: 200 })
    );
    mockSql.mockResolvedValueOnce({
      rows: [{ id: 'quote-id' }],
    });

    const res = await POST(
      createRequest({
        fiat_amount_cents: 500,
        creator_id: CREATOR_ID,
      })
    );

    expect(res.headers.get('x-request-id')).toBeDefined();
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('rejects invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/tips/get-quote', {
      method: 'POST',
      body: 'not json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON body');
  });
});
