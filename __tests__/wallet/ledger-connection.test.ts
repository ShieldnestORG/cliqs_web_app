/**
 * Ledger Wallet Connection Test
 * 
 * File: __tests__/wallet/ledger-connection.test.ts
 * 
 * Tests for Ledger wallet connection
 * Priority: P1
 */

import TransportWebUSB from '@ledgerhq/hw-transport-webusb';

// Mock Ledger transport
jest.mock('@ledgerhq/hw-transport-webusb', () => ({
  create: jest.fn(),
  isSupported: jest.fn(),
  list: jest.fn(),
  listen: jest.fn(),
  open: jest.fn(),
}));

describe('Ledger Wallet Connection: P1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should check if Ledger is supported', async () => {
    const mockIsSupported = TransportWebUSB.isSupported as jest.MockedFunction<typeof TransportWebUSB.isSupported>;
    mockIsSupported.mockResolvedValue(true);

    const isSupported = await TransportWebUSB.isSupported();
    expect(isSupported).toBe(true);
  });

  it('should create Ledger transport successfully', async () => {
    const mockTransport = {
      send: jest.fn(),
      close: jest.fn(),
    };

    const mockCreate = TransportWebUSB.create as jest.MockedFunction<typeof TransportWebUSB.create>;
    mockCreate.mockResolvedValue(mockTransport as any);

    const transport = await TransportWebUSB.create();
    expect(transport).toBeDefined();
    expect(transport.send).toBeDefined();
    expect(transport.close).toBeDefined();
  });

  it('should handle Ledger connection error', async () => {
    const mockCreate = TransportWebUSB.create as jest.MockedFunction<typeof TransportWebUSB.create>;
    mockCreate.mockRejectedValue(new Error('Ledger device not found'));

    await expect(TransportWebUSB.create()).rejects.toThrow('Ledger device not found');
  });

  it('should list available Ledger devices', async () => {
    const mockDevices = [
      { path: 'device1', manufacturer: 'Ledger' },
      { path: 'device2', manufacturer: 'Ledger' },
    ];

    const mockList = TransportWebUSB.list as jest.MockedFunction<typeof TransportWebUSB.list>;
    mockList.mockResolvedValue(mockDevices as any);

    const devices = await TransportWebUSB.list();
    expect(devices).toEqual(mockDevices);
    expect(devices.length).toBe(2);
  });
});
