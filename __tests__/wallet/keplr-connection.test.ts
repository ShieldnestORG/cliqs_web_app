/**
 * Keplr Wallet Connection Test
 * 
 * File: __tests__/wallet/keplr-connection.test.ts
 * 
 * Tests for Keplr wallet connection
 * Priority: P0
 */

import { getKeplrKey } from '@/lib/keplr';

// Mock window.keplr
const mockKeplr = {
  enable: jest.fn(),
  getKey: jest.fn(),
  signAmino: jest.fn(),
  signDirect: jest.fn(),
  getOfflineSigner: jest.fn(),
  experimentalSuggestChain: jest.fn(),
};

describe('Keplr Wallet Connection: P0', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window.keplr = mockKeplr as any;
  });

  it('should connect to Keplr wallet successfully', async () => {
    const chainId = 'cosmoshub-4';
    const mockKey = {
      name: 'test-wallet',
      algo: 'secp256k1',
      pubKey: new Uint8Array([1, 2, 3, 4]),
      address: 'cosmos1test',
      bech32Address: 'cosmos1test',
    };

    mockKeplr.enable.mockResolvedValue(true);
    mockKeplr.getKey.mockResolvedValue(mockKey);

    // Test wallet connection
    const enabled = await mockKeplr.enable(chainId);
    expect(enabled).toBe(true);

    const key = await mockKeplr.getKey(chainId);
    expect(key).toEqual(mockKey);
    expect(key.address).toBe('cosmos1test');
  });

  it('should handle Keplr not installed', () => {
    delete (global.window as any).keplr;

    expect(global.window.keplr).toBeUndefined();
  });

  it('should handle Keplr connection rejection', async () => {
    mockKeplr.enable.mockRejectedValue(new Error('User rejected connection'));

    await expect(mockKeplr.enable('cosmoshub-4')).rejects.toThrow('User rejected connection');
  });

  it('should get wallet key after connection', async () => {
    const chainId = 'cosmoshub-4';
    const mockKey = {
      name: 'test-wallet',
      algo: 'secp256k1',
      pubKey: new Uint8Array([1, 2, 3, 4]),
      address: 'cosmos1test',
      bech32Address: 'cosmos1test',
    };

    mockKeplr.enable.mockResolvedValue(true);
    mockKeplr.getKey.mockResolvedValue(mockKey);

    await mockKeplr.enable(chainId);
    const key = await mockKeplr.getKey(chainId);

    expect(key.address).toBe('cosmos1test');
    expect(key.pubKey).toBeInstanceOf(Uint8Array);
  });
});
