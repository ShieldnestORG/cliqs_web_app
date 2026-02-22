/**
 * List Multisigs API Route Test
 * 
 * File: __tests__/api/list-multisigs.test.ts
 * 
 * Tests for POST /api/chain/[chainId]/multisig/list
 * Priority: P0
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from 'node-mocks-http';
import apiListMultisigs from '@/pages/api/chain/[chainId]/multisig/list/index';
import { getCreatedMultisigs, getBelongedMultisigs } from '@/graphql/multisig';
import { parseResponseData } from '../helpers';
import { getNonce, incrementNonce } from '@/graphql/nonce';
import { StargateClient } from '@cosmjs/stargate';

// Mock GraphQL functions
jest.mock('@/graphql/multisig', () => ({
  getCreatedMultisigs: jest.fn(),
  getBelongedMultisigs: jest.fn(),
}));

jest.mock('@/graphql/nonce', () => ({
  getNonce: jest.fn(),
  incrementNonce: jest.fn(),
}));

jest.mock('@cosmjs/stargate', () => ({
  StargateClient: {
    connect: jest.fn(),
  },
}));

jest.mock('@/lib/keplr', () => ({
  verifyKeplrSignature: jest.fn().mockResolvedValue(true),
}));

const mockGetCreatedMultisigs = getCreatedMultisigs as jest.MockedFunction<typeof getCreatedMultisigs>;
const mockGetBelongedMultisigs = getBelongedMultisigs as jest.MockedFunction<typeof getBelongedMultisigs>;
const mockGetNonce = getNonce as jest.MockedFunction<typeof getNonce>;
const mockIncrementNonce = incrementNonce as jest.MockedFunction<typeof incrementNonce>;
const mockStargateConnect = StargateClient.connect as jest.MockedFunction<typeof StargateClient.connect>;

describe('API: POST /api/chain/[chainId]/multisig/list - List Multisigs: P0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Stargate client
    mockStargateConnect.mockResolvedValue({
      getAccount: jest.fn().mockResolvedValue({
        address: 'cosmos1test',
        accountNumber: 1,
        sequence: 0,
      }),
    } as any);
  });

  it('should list multisigs with signature successfully', async () => {
    const chainId = 'cosmoshub-4';
    const mockCreated = [{ id: '1', address: 'cosmos1created' }];
    const mockBelonged = [{ id: '2', address: 'cosmos1belonged' }];

    mockGetNonce.mockResolvedValue(1);
    mockIncrementNonce.mockResolvedValue(2);
    mockGetCreatedMultisigs.mockResolvedValue(mockCreated);
    mockGetBelongedMultisigs.mockResolvedValue(mockBelonged);

    const { req, res } = createMocks({
      method: 'POST',
      query: { chainId },
      body: {
        chain: {
          chainId,
          addressPrefix: 'cosmos',
          nodeAddress: 'https://rpc.cosmos.network',
        },
        signature: {
          pub_key: {
            type: 'tendermint/PubKeySecp256k1',
            value: 'test-pubkey',
          },
          signature: 'test-signature',
        },
      },
    });

    await apiListMultisigs(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.created).toEqual(mockCreated);
    expect(data.belonged).toEqual(mockBelonged);
  });

  it('should list multisigs with address and pubkey successfully', async () => {
    const chainId = 'cosmoshub-4';
    const mockCreated = [{ id: '1', address: 'cosmos1created' }];
    const mockBelonged = [{ id: '2', address: 'cosmos1belonged' }];

    mockGetCreatedMultisigs.mockResolvedValue(mockCreated);
    mockGetBelongedMultisigs.mockResolvedValue(mockBelonged);

    const { req, res } = createMocks({
      method: 'POST',
      query: { chainId },
      body: {
        chain: {
          chainId,
          addressPrefix: 'cosmos',
          nodeAddress: 'https://rpc.cosmos.network',
        },
        address: 'cosmos1test',
        pubkey: 'test-pubkey-base64',
      },
    });

    await apiListMultisigs(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    const data = parseResponseData(res._getData());
    expect(data.created).toEqual(mockCreated);
    expect(data.belonged).toEqual(mockBelonged);
  });

  it('should return 405 for non-POST methods', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { chainId: 'cosmoshub-4' },
    });

    await apiListMultisigs(req as any, res as any);

    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 400 when chainId mismatch', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      query: { chainId: 'cosmoshub-4' },
      body: {
        chain: { chainId: 'different-chain' },
        address: 'cosmos1test',
        pubkey: 'test-pubkey',
      },
    });

    await apiListMultisigs(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });

  it('should return 400 when account not found on chain', async () => {
    mockStargateConnect.mockResolvedValue({
      getAccount: jest.fn().mockResolvedValue(null),
    } as any);

    const { req, res } = createMocks({
      method: 'POST',
      query: { chainId: 'cosmoshub-4' },
      body: {
        chain: {
          chainId: 'cosmoshub-4',
          addressPrefix: 'cosmos',
          nodeAddress: 'https://rpc.cosmos.network',
        },
        address: 'cosmos1nonexistent',
        pubkey: 'test-pubkey',
      },
    });

    await apiListMultisigs(req as any, res as any);

    expect(res._getStatusCode()).toBe(400);
  });
});
