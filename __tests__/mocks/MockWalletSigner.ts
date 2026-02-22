/**
 * Mock Wallet Signer for Autonomous Testing
 *
 * File: __tests__/mocks/MockWalletSigner.ts
 *
 * Provides deterministic signing for integration tests without requiring
 * real wallet interactions or WalletConnect UI.
 */

export type Signature = {
  pubkey: string;
  signature: string;
};

export interface WalletSigner {
  getAddress(): Promise<string> | string;
  sign(bytes: Uint8Array, meta?: Record<string, unknown>): Promise<Signature>;
}

export class MockWalletSigner implements WalletSigner {
  private address: string;
  private rejectSign: boolean;

  constructor(opts: { address?: string; rejectSign?: boolean } = {}) {
    this.address = opts.address ?? "cosmos1mockaddressxxxxxxxxxxxxxx";
    this.rejectSign = opts.rejectSign ?? false;
  }

  getAddress(): string {
    return this.address;
  }

  async sign(bytes: Uint8Array): Promise<Signature> {
    if (this.rejectSign) {
      throw new Error("USER_REJECTED_SIGNATURE");
    }

    // Create deterministic signature based on input bytes
    const hex = Buffer.from(bytes).toString("hex");
    const signature = hex.slice(0, 128).padEnd(128, "0");

    return {
      pubkey: "MockPubKeyBase64==",
      signature,
    };
  }
}
