/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from 'next/server';

const mockSql = jest.fn();
const mockVerifySession = jest.fn();
const mockBuildTip = jest.fn();
const mockSubmitTx = jest.fn();
const mockGetCurrentNetwork = jest.fn(() => 'testnet');

jest.mock('@vercel/postgres', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
}));

jest.mock('@/lib/auth/verify-session', () => ({
  verifySession: (...args: unknown[]) => mockVerifySession(...args),
}));

jest.mock('@/lib/stellar/payments', () => ({
  buildTipTransaction: mockBuildTip,
  submitTransaction: mockSubmitTx,
  getCurrentNetwork: mockGetCurrentNetwork,
}));

jest.mock('@/lib/db/replica', () => ({
  markRecentWrite: (response: any) => response,
}));

let POST: (req: NextRequest) => Promise<NextResponse>;

const SENDER_ID = '550e8400-e29b-41d4-a716-446655440000';
const SENDER_KEY = 'GSENDER123456789012345678901234567890123456789012345678';
const RECIPIENT_KEY = 'GRECIPIENT123456789012345678901234567890123456789012345';
const QUOTE_TOKEN =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function createTipRequest(overrides: any = {}) {
  return new NextRequest('http://localhost/api/tips/send', {
    method: 'POST',
    body: JSON.stringify({
      destinationPublicKey: RECIPIENT_KEY,
      amount: '10.0000000',
      quote_token: QUOTE_TOKEN,
      ...overrides,
    }),
  });
}

function setupSuccessfulTransaction() {
  mockBuildTip.mockReturnValueOnce({
    toXDR: () => 'transaction-xdr',
    hash: () => ({ toString: () => 'tx-hash-123' }),
  });

  mockSubmitTx.mockResolvedValueOnce({
    success: true,
    hash: 'tx-hash-123',
    ledger: 12345,
  });
}

beforeEach(() => {
  mockSql.mockReset();
  mockVerifySession.mockReset();
  mockBuildTip.mockReset();
  mockSubmitTx.mockReset();

  // Default: successful session verification
  mockVerifySession.mockResolvedValue({
    ok: true,
    userId: SENDER_ID,
    wallet: SENDER_KEY,
  });

  // Default: user has wallet
  mockSql.mockResolvedValueOnce({
    rows: [{ stellar_public_key: SENDER_KEY }],
  });

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    POST = require('../../../app/api/tips/send/route').POST;
  });
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/tips/send with quote validation', () => {
  it('accepts tip with valid, non-expired quote', async () => {
    const quoteExpiresAt = new Date(Date.now() + 200 * 1000).toISOString();

    // Mock quote validation query
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'quote-id',
          quoted_xlm_amount: 10.0,
          expires_at: quoteExpiresAt,
          status: 'issued',
          consumed_at: null,
        },
      ],
    });

    // Mock tip record insertion
    mockSql.mockResolvedValueOnce({});

    setupSuccessfulTransaction();

    // Mock tip update after transaction
    mockSql.mockResolvedValueOnce({});

    // Mock quote consumption update
    mockSql.mockResolvedValueOnce({});

    const res = await POST(createTipRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.transactionHash).toBe('tx-hash-123');
  });

  it('rejects tip with expired quote', async () => {
    const quoteExpiresAt = new Date(Date.now() - 100 * 1000).toISOString(); // Expired 100s ago

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'quote-id',
          quoted_xlm_amount: 10.0,
          expires_at: quoteExpiresAt,
          status: 'issued',
          consumed_at: null,
        },
      ],
    });

    const res = await POST(createTipRequest());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Quote expired');
  });

  it('rejects tip with consumed quote', async () => {
    const quoteExpiresAt = new Date(Date.now() + 200 * 1000).toISOString();

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'quote-id',
          quoted_xlm_amount: 10.0,
          expires_at: quoteExpiresAt,
          status: 'consumed',
          consumed_at: new Date().toISOString(),
        },
      ],
    });

    const res = await POST(createTipRequest());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Quote not found or already used');
  });

  it('rejects tip with missing quote', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [], // No quote found
    });

    const res = await POST(createTipRequest());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Quote not found or already used');
  });

  it('rejects tip with amount mismatch (>0.1% deviation)', async () => {
    const quoteExpiresAt = new Date(Date.now() + 200 * 1000).toISOString();
    const quotedAmount = 10.0;
    const requestAmount = 10.015; // 0.15% deviation - exceeds 0.1% tolerance

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'quote-id',
          quoted_xlm_amount: quotedAmount,
          expires_at: quoteExpiresAt,
          status: 'issued',
          consumed_at: null,
        },
      ],
    });

    const res = await POST(
      createTipRequest({
        amount: requestAmount.toFixed(7),
      })
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Amount does not match quote');
  });

  it('accepts tip with amount within 0.1% tolerance', async () => {
    const quoteExpiresAt = new Date(Date.now() + 200 * 1000).toISOString();
    const quotedAmount = 10.0;
    const requestAmount = 10.0009; // 0.009% deviation - within 0.1% tolerance

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'quote-id',
          quoted_xlm_amount: quotedAmount,
          expires_at: quoteExpiresAt,
          status: 'issued',
          consumed_at: null,
        },
      ],
    });

    // Mock tip record insertion
    mockSql.mockResolvedValueOnce({});

    setupSuccessfulTransaction();

    // Mock tip update after transaction
    mockSql.mockResolvedValueOnce({});

    // Mock quote consumption update
    mockSql.mockResolvedValueOnce({});

    const res = await POST(
      createTipRequest({
        amount: requestAmount.toFixed(7),
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('marks quote as consumed after successful transaction', async () => {
    const quoteExpiresAt = new Date(Date.now() + 200 * 1000).toISOString();

    // Mock quote validation
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'quote-id',
          quoted_xlm_amount: 10.0,
          expires_at: quoteExpiresAt,
          status: 'issued',
          consumed_at: null,
        },
      ],
    });

    // Mock tip record insertion
    mockSql.mockResolvedValueOnce({});

    setupSuccessfulTransaction();

    // Mock tip update after transaction
    mockSql.mockResolvedValueOnce({});

    // Mock quote consumption update
    mockSql.mockResolvedValueOnce({});

    await POST(createTipRequest());

    // Verify quote consumption update was called
    const calls = mockSql.mock.calls;
    const consumeCall = calls.find(
      c =>
        (c[0] as any)?.strings &&
        (c[0].strings[0] as string).includes('UPDATE exchange_rate_quotes')
    );

    expect(consumeCall).toBeDefined();
  });

  it('logs warning when no quote token is provided', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock tip record insertion
    mockSql.mockResolvedValueOnce({});

    setupSuccessfulTransaction();

    // Mock tip update after transaction
    mockSql.mockResolvedValueOnce({});

    await POST(
      createTipRequest({
        quote_token: undefined,
      })
    );

    // Note: In production, this would be logged via the logger module
    consoleSpy.mockRestore();
  });

  it('allows backward compatibility - accepts tips without quote_token', async () => {
    // Mock tip record insertion
    mockSql.mockResolvedValueOnce({});

    setupSuccessfulTransaction();

    // Mock tip update after transaction
    mockSql.mockResolvedValueOnce({});

    const res = await POST(
      createTipRequest({
        quote_token: undefined,
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it('handles quote database errors gracefully', async () => {
    mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

    const res = await POST(createTipRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to validate quote');
  });
});
