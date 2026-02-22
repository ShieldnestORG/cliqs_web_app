/**
 * Mock Broadcaster for Autonomous Testing
 *
 * File: __tests__/mocks/MockBroadcaster.ts
 *
 * Provides controlled broadcast behavior for integration tests.
 * Uses a queue to allow pre-configuring success/failure scenarios.
 */

export type BroadcastResult = {
  code: number;
  txhash?: string;
  rawLog?: string;
};

export interface Broadcaster {
  broadcastTx(txBytes: Uint8Array): Promise<BroadcastResult>;
}

export class MockBroadcaster implements Broadcaster {
  private queue: Array<() => Promise<BroadcastResult>> = [];

  /**
   * Enqueue a successful broadcast result
   */
  enqueueSuccess(result: BroadcastResult = { code: 0, txhash: "MOCK_TX_HASH" }): void {
    this.queue.push(async () => result);
  }

  /**
   * Enqueue a broadcast failure
   */
  enqueueFailure(err: Error = new Error("RPC_DOWN")): void {
    this.queue.push(async () => {
      throw err;
    });
  }

  /**
   * Clear the queue and reset to default behavior
   */
  reset(): void {
    this.queue = [];
  }

  async broadcastTx(_txBytes: Uint8Array): Promise<BroadcastResult> {
    const fn = this.queue.shift();
    if (!fn) {
      // Default successful broadcast if queue is empty
      return { code: 0, txhash: "MOCK_TX_HASH" };
    }
    return fn();
  }
}
