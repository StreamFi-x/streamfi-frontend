import { GET } from '../route';
import { sql } from '@vercel/postgres';
import * as horizonModule from '@/lib/stellar/horizon';

// Mock dependencies
jest.mock('@vercel/postgres');
jest.mock('@/lib/stellar/horizon');

const mockSql = sql as jest.MockedFunction<typeof sql>;
const mockFetchPaymentsReceived = horizonModule.fetchPaymentsReceived as jest.MockedFunction<
  typeof horizonModule.fetchPaymentsReceived
>;

describe('GET /api/tips/[username]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for invalid username', async () => {
    const request = new Request('http://localhost/api/tips/');
    const response = await GET(request, { params: { username: '' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid username');
  });

  it('should return 400 for username too long', async () => {
    const longUsername = 'a'.repeat(65);
    const request = new Request('http://localhost/api/tips/');
    const response = await GET(request, { params: { username: longUsername } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid username');
  });

  it('should return 404 when user not found', async () => {
    mockSql.mockResolvedValueOnce({ rows: [] } as any);

    const request = new Request('http://localhost/api/tips/nonexistent');
    const response = await GET(request, { params: { username: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User not found');
  });

  it('should return 404 when user has no Stellar key', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: null,
          total_tips_received: null,
          total_tips_count: 0,
        },
      ],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser');
    const response = await GET(request, { params: { username: 'testuser' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('User has not configured Stellar wallet');
  });

  it('should return tips with pagination for valid user', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [
        {
          id: '1',
          sender: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5V3VF',
          amount: '100',
          asset: 'XLM',
          txHash: 'tx_1',
          timestamp: '2024-01-01T00:00:00Z',
          ledger: 1,
        },
        {
          id: '2',
          sender: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZBXRWS',
          amount: '50',
          asset: 'USDC:GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          txHash: 'tx_2',
          timestamp: '2024-01-02T00:00:00Z',
          ledger: 2,
        },
      ],
      nextCursor: 'cursor_123',
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser?limit=20');
    const response = await GET(request, { params: { username: 'testuser' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.tips).toHaveLength(2);
    expect(data.pagination.nextCursor).toBe('cursor_123');
    expect(data.pagination.hasMore).toBe(true);
    expect(data.total.received).toBe('500');
    expect(data.total.count).toBe(5);
  });

  it('should map sender public keys to usernames', async () => {
    const senderKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5V3VF';

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: senderKey,
          total_tips_received: '100',
          total_tips_count: 1,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [
        {
          id: '1',
          sender: senderKey,
          amount: '100',
          asset: 'XLM',
          txHash: 'tx_1',
          timestamp: '2024-01-01T00:00:00Z',
          ledger: 1,
        },
      ],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: senderKey,
          username: 'donor-user',
        },
      ],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser');
    const response = await GET(request, { params: { username: 'testuser' } });
    const data = await response.json();

    expect(data.tips[0].senderUsername).toBe('donor-user');
  });

  it('should handle tips from unclaimed senders', async () => {
    const senderKey = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5V3VF';

    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: senderKey,
          total_tips_received: '100',
          total_tips_count: 1,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [
        {
          id: '1',
          sender: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBZBXRWS',
          amount: '100',
          asset: 'XLM',
          txHash: 'tx_1',
          timestamp: '2024-01-01T00:00:00Z',
          ledger: 1,
        },
      ],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser');
    const response = await GET(request, { params: { username: 'testuser' } });
    const data = await response.json();

    expect(data.tips[0].senderUsername).toBeNull();
  });

  it('should respect pagination limit parameter', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser?limit=50');
    await GET(request, { params: { username: 'testuser' } });

    expect(mockFetchPaymentsReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 50,
      })
    );
  });

  it('should cap limit at 100', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser?limit=200');
    await GET(request, { params: { username: 'testuser' } });

    expect(mockFetchPaymentsReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100,
      })
    );
  });

  it('should handle invalid limit parameter', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser?limit=abc');
    await GET(request, { params: { username: 'testuser' } });

    expect(mockFetchPaymentsReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20, // Should use default
      })
    );
  });

  it('should handle cursor pagination', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValueOnce({
      tips: [],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request = new Request('http://localhost/api/tips/testuser?cursor=previous_cursor_123');
    await GET(request, { params: { username: 'testuser' } });

    expect(mockFetchPaymentsReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 'previous_cursor_123',
      })
    );
  });

  it('should handle Horizon API timeout errors', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockRejectedValueOnce(new Error('Request timeout'));

    const request = new Request('http://localhost/api/tips/testuser');
    const response = await GET(request, { params: { username: 'testuser' } });
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.error).toBe('Horizon API timeout');
  });

  it('should handle generic errors', async () => {
    mockSql.mockResolvedValueOnce({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockRejectedValueOnce(new Error('Database error'));

    const request = new Request('http://localhost/api/tips/testuser');
    const response = await GET(request, { params: { username: 'testuser' } });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch tip history');
  });

  it('should cache responses correctly', async () => {
    mockSql.mockResolvedValue({
      rows: [
        {
          stellar_public_key: 'GBUQWP3BOUZX34ULNQG23RQ6F4BWFIYK6VSP7UNYXNUO2SDOLXZJXJEY',
          total_tips_received: '500',
          total_tips_count: 5,
        },
      ],
    } as any);

    mockFetchPaymentsReceived.mockResolvedValue({
      tips: [
        {
          id: '1',
          sender: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5V3VF',
          amount: '100',
          asset: 'XLM',
          txHash: 'tx_1',
          timestamp: '2024-01-01T00:00:00Z',
          ledger: 1,
        },
      ],
      nextCursor: undefined,
    });

    mockSql.mockResolvedValueOnce({
      rows: [],
    } as any);

    const request1 = new Request('http://localhost/api/tips/testuser');
    const response1 = await GET(request1, { params: { username: 'testuser' } });
    expect(response1.status).toBe(200);

    // Second request should use cache
    const request2 = new Request('http://localhost/api/tips/testuser');
    const response2 = await GET(request2, { params: { username: 'testuser' } });
    expect(response2.status).toBe(200);

    // fetchPaymentsReceived should only be called once due to caching
    expect(mockFetchPaymentsReceived).toHaveBeenCalledTimes(1);
  });
});
