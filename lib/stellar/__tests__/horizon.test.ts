import { fetchPaymentsReceived } from '../horizon';
import { getStellarNetwork } from '../config';
import { Server } from '@stellar/stellar-sdk';

// Mock the stellar-sdk
jest.mock('@stellar/stellar-sdk');
jest.mock('../config');

const mockGetStellarNetwork = getStellarNetwork as jest.MockedFunction<typeof getStellarNetwork>;

describe('horizon - fetchPaymentsReceived', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStellarNetwork.mockReturnValue('testnet');
  });

  it('should successfully fetch payments without cursor', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({
        records: [
          {
            id: '1',
            type: 'payment',
            to: 'public_key_1',
            from: 'sender_1',
            amount: '100',
            asset_type: 'native',
            asset_code: undefined,
            asset_issuer: undefined,
            transaction_hash: 'tx_hash_1',
            created_at: '2024-01-01T00:00:00Z',
            ledger: 1,
            paging_token: 'cursor_1',
          },
          {
            id: '2',
            type: 'payment',
            to: 'public_key_1',
            from: 'sender_2',
            amount: '50',
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'issuer_1',
            transaction_hash: 'tx_hash_2',
            created_at: '2024-01-02T00:00:00Z',
            ledger: 2,
            paging_token: 'cursor_2',
          },
        ],
      }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    const result = await fetchPaymentsReceived({
      publicKey: 'public_key_1',
      limit: 20,
    });

    expect(result.tips).toHaveLength(2);
    expect(result.tips[0]).toEqual({
      id: '1',
      sender: 'sender_1',
      amount: '100',
      asset: 'XLM',
      txHash: 'tx_hash_1',
      timestamp: '2024-01-01T00:00:00Z',
      ledger: 1,
    });
    expect(result.tips[1]).toEqual({
      id: '2',
      sender: 'sender_2',
      amount: '50',
      asset: 'USDC:issuer_1',
      txHash: 'tx_hash_2',
      timestamp: '2024-01-02T00:00:00Z',
      ledger: 2,
    });
    expect(result.nextCursor).toBe('cursor_2');
    expect(mockPaymentsBuilder.cursor).not.toHaveBeenCalled();
  });

  it('should include cursor when provided', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      cursor: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({
        records: [
          {
            id: '3',
            type: 'payment',
            to: 'public_key_1',
            from: 'sender_3',
            amount: '75',
            asset_type: 'native',
            transaction_hash: 'tx_hash_3',
            created_at: '2024-01-03T00:00:00Z',
            ledger: 3,
            paging_token: 'cursor_3',
          },
        ],
      }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    const result = await fetchPaymentsReceived({
      publicKey: 'public_key_1',
      cursor: 'previous_cursor',
      limit: 20,
    });

    expect(mockPaymentsBuilder.cursor).toHaveBeenCalledWith('previous_cursor');
    expect(result.tips).toHaveLength(1);
    expect(result.nextCursor).toBe('cursor_3');
  });

  it('should handle empty records array', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({
        records: [],
      }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    const result = await fetchPaymentsReceived({
      publicKey: 'public_key_1',
    });

    expect(result.tips).toHaveLength(0);
    expect(result.nextCursor).toBeUndefined();
  });

  it('should filter out non-payment transactions', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({
        records: [
          {
            id: '1',
            type: 'payment',
            to: 'public_key_1',
            from: 'sender_1',
            amount: '100',
            asset_type: 'native',
            transaction_hash: 'tx_hash_1',
            created_at: '2024-01-01T00:00:00Z',
            ledger: 1,
            paging_token: 'cursor_1',
          },
          {
            id: '2',
            type: 'trade',
            to: 'public_key_1',
            from: 'sender_2',
            paging_token: 'cursor_2',
          },
          {
            id: '3',
            type: 'payment',
            to: 'other_key',
            from: 'sender_3',
            amount: '50',
            asset_type: 'native',
            transaction_hash: 'tx_hash_3',
            created_at: '2024-01-03T00:00:00Z',
            ledger: 3,
            paging_token: 'cursor_3',
          },
        ],
      }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    const result = await fetchPaymentsReceived({
      publicKey: 'public_key_1',
    });

    expect(result.tips).toHaveLength(1);
    expect(result.tips[0].id).toBe('1');
  });

  it('should handle credit_alphanum12 assets', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({
        records: [
          {
            id: '1',
            type: 'payment',
            to: 'public_key_1',
            from: 'sender_1',
            amount: '100',
            asset_type: 'credit_alphanum12',
            asset_code: 'LONGASSET',
            asset_issuer: 'issuer_1',
            transaction_hash: 'tx_hash_1',
            created_at: '2024-01-01T00:00:00Z',
            ledger: 1,
            paging_token: 'cursor_1',
          },
        ],
      }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    const result = await fetchPaymentsReceived({
      publicKey: 'public_key_1',
    });

    expect(result.tips[0].asset).toBe('LONGASSET:issuer_1');
  });

  it('should use testnet by default', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({ records: [] }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    await fetchPaymentsReceived({
      publicKey: 'public_key_1',
    });

    expect(Server).toHaveBeenCalledWith('https://horizon-testnet.stellar.org');
  });

  it('should use mainnet when specified', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({ records: [] }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    await fetchPaymentsReceived({
      publicKey: 'public_key_1',
      network: 'mainnet',
    });

    expect(Server).toHaveBeenCalledWith('https://horizon.stellar.org');
  });

  it('should handle network errors', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockRejectedValue(new Error('Network error')),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    await expect(
      fetchPaymentsReceived({
        publicKey: 'public_key_1',
      })
    ).rejects.toThrow('Network error');
  });

  it('should apply custom limit', async () => {
    const mockPaymentsBuilder = {
      forAccount: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      call: jest.fn().mockResolvedValue({ records: [] }),
    };

    const mockServerInstance = {
      payments: jest.fn().mockReturnValue(mockPaymentsBuilder),
    };

    (Server as jest.MockedClass<typeof Server>).mockImplementation(
      () => mockServerInstance as any
    );

    await fetchPaymentsReceived({
      publicKey: 'public_key_1',
      limit: 50,
    });

    expect(mockPaymentsBuilder.limit).toHaveBeenCalledWith(50);
  });
});
