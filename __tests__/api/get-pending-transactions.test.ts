/**
 * Get Pending Transactions API Route Test
 * 
 * File: __tests__/api/get-pending-transactions.test.ts
 * 
 * Tests for POST /api/transaction/pending
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from 'node-mocks-http';
import apiGetPendingTransactions from '@/pages/api/transaction/pending/index';
import { getMultisig } from '@/graphql';
import { getPendingTransactions } from '@/graphql/transaction';
import { parseResponseData } from '../helpers';

// Mock GraphQL functions
jest.mock('@/graphql', () => ({
  getMultisig: jest.fn(),
}));

jest.mock('@/graphql/transaction', () => ({
  getPendingTransactions: jest.fn(),
}));

const mockGetMultisig = getMultisig as jest.MockedFunction<typeof getMultisig>;
const mockGetPendingTransactions = getPendingTransactions as jest.MockedFunction<typeof getPendingTransactions>;

describe('API: POST /api/transaction/pending - Get Pending Transactions: P0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get pending transactions successfully', async () => {
    const chainId = 'cosmoshub-4';
    const multisigAddress = 'cosmos1multisig';
    const mockMultisig = {
      id: 'multisig-id-123',
      address: multisigAddress,
      chainId,
    };
    const mockPendingTxs = [
      {
        id: 'tx-id-1',
        dataJSON: JSON.stringify({ chainId }),
        signatures: [],
      },
      {
        id: 'tx-id-2',
        dataJSON: JSON.stringify({ chainId }),
        signatures: [{ id: 'sig-1' }],
      },
    ];

    mockGetMultisig.mockResolvedValue(mockMultisig);
    mockGetPendingTransactions.mockResolvedValue(mockPendingTxs);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        chainId,
        multisigAddress,
      },
    });

    await apiGetPendingTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data).toEqual(mockPendingTxs);
    expect(mockGetMultisig).toHaveBeenCalledWith(chainId, multisigAddress);
    expect(mockGetPendingTransactions).toHaveBeenCalledWith(mockMultisig.id);
  });

  it('should return empty array when multisig not found', async () => {
    mockGetMultisig.mockResolvedValue(null);

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        chainId: 'cosmoshub-4',
        multisigAddress: 'cosmos1nonexistent',
      },
    });

    await apiGetPendingTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data).toEqual([]);
  });

  it('should return 405 for non-POST methods', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await apiGetPendingTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 on error', async () => {
    mockGetMultisig.mockRejectedValue(new Error('Database error'));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        chainId: 'cosmoshub-4',
        multisigAddress: 'cosmos1test',
      },
    });

    await apiGetPendingTransactions(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getData()).toContain('Failed to get pending transactions');
  });
});
