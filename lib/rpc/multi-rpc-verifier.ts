/**
 * Multi-RPC Broadcast Verifier
 *
 * File: lib/rpc/multi-rpc-verifier.ts
 *
 * Implements hardened broadcast with cross-endpoint confirmation.
 *
 * Broadcast policy:
 * 1. Primary: Send tx to private/trusted RPC endpoint
 * 2. Secondary: Confirm via multiple independent endpoints
 * 3. Never trust "success" from a single RPC as final
 */

import { StargateClient, DeliverTxResponse } from "@cosmjs/stargate";
import { toHex } from "@cosmjs/encoding";
import { sha256 } from "@cosmjs/crypto";

import {
  EndpointManager,
  EndpointConfig,
  RpcEndpoint,
  getEndpointManager,
} from "./endpoint-manager";

// ============================================================================
// Types
// ============================================================================

export interface BroadcastResult {
  /** Transaction hash */
  readonly txHash: string;
  /** Whether broadcast was successful */
  readonly success: boolean;
  /** Block height if confirmed */
  readonly height?: number;
  /** Gas used */
  readonly gasUsed?: number;
  /** Gas wanted */
  readonly gasWanted?: number;
  /** Raw log from chain */
  readonly rawLog?: string;
  /** Error message if failed */
  readonly error?: string;
  /** Which endpoint was used for broadcast */
  readonly broadcastEndpoint: string;
  /** Verification results from other endpoints */
  readonly verifications: readonly VerificationResult[];
}

export interface VerificationResult {
  /** Endpoint URL */
  readonly endpoint: string;
  /** Whether tx was verified on this endpoint */
  readonly verified: boolean;
  /** Block height seen */
  readonly height?: number;
  /** Error if verification failed */
  readonly error?: string;
  /** Response time in ms */
  readonly responseTimeMs: number;
}

export interface StateCheck {
  /** Type of check */
  readonly type: "balance" | "account" | "custom";
  /** Address to check */
  readonly address: string;
  /** Expected value (for comparison) */
  readonly expected?: unknown;
  /** Description for logging */
  readonly description: string;
}

export interface StateVerificationResult {
  /** Whether state change was verified */
  readonly verified: boolean;
  /** Details of each check */
  readonly checks: readonly StateCheckResult[];
}

export interface StateCheckResult {
  readonly check: StateCheck;
  readonly result: unknown;
  readonly matched: boolean;
  readonly error?: string;
}

// ============================================================================
// MultiRpcVerifier Class
// ============================================================================

export class MultiRpcVerifier {
  private readonly config: EndpointConfig;
  private readonly endpointManager: EndpointManager;
  private clients: Map<string, StargateClient> = new Map();

  constructor(config: EndpointConfig) {
    this.config = config;
    this.endpointManager = getEndpointManager();
    this.endpointManager.setConfig(config.chainId, config);
  }

  /**
   * Broadcast transaction and verify across multiple endpoints
   *
   * 1. Broadcast to primary endpoint
   * 2. Wait for confirmation
   * 3. Verify on secondary/witness endpoints
   * 4. Return comprehensive result
   */
  async broadcastAndVerify(txBytes: Uint8Array): Promise<BroadcastResult> {
    const txHash = toHex(sha256(txBytes)).toUpperCase();
    console.log(`📡 Broadcasting transaction: ${txHash}`);

    // Get primary endpoint for broadcast
    const primaryEndpoint = this.getPrimaryEndpoint();
    if (!primaryEndpoint) {
      return {
        txHash,
        success: false,
        error: "No primary endpoint configured",
        broadcastEndpoint: "",
        verifications: [],
      };
    }

    // Step 1: Broadcast to primary
    let broadcastResponse: DeliverTxResponse;
    const client = await this.getClient(primaryEndpoint.url);

    try {
      // First, check if somehow this transaction is already confirmed
      const existingTx = await client.getTx(txHash);
      if (existingTx) {
        console.log(`✅ Transaction found already confirmed on chain!`);
        broadcastResponse = {
          code: existingTx.code,
          height: existingTx.height,
          txIndex: existingTx.txIndex,
          transactionHash: existingTx.hash,
          gasUsed: BigInt(existingTx.gasUsed),
          gasWanted: BigInt(existingTx.gasWanted),
          rawLog: existingTx.rawLog || "Recovered existing tx",
          events: existingTx.events,
          msgResponses: [],
        };
      } else {
        console.log(`📡 Broadcasting via primary: ${primaryEndpoint.url}`);
        broadcastResponse = await client.broadcastTx(txBytes);
        console.log(`✅ Broadcast response:`, {
          code: broadcastResponse.code,
          height: broadcastResponse.height,
          txHash: broadcastResponse.transactionHash,
        });
      }
    } catch (error) {
      console.error(`❌ Broadcast failed:`, error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      // If the node rejects it because it's already in the mempool cache,
      // it means our transaction is valid and waiting to be included in a block.
      // We should wait for it to be confirmed rather than crashing.
      if (
        errorMsg.includes("tx already exists in cache") ||
        errorMsg.includes("transaction already exists")
      ) {
        console.log(`⏳ Transaction is tracking in the mempool cache. Waiting for confirmation...`);
        const confirmResult = await this.waitForConfirmation(txHash, 15, 2000);

        if (confirmResult.confirmed) {
          console.log(`✅ Transaction finally confirmed at height ${confirmResult.height}`);

          // Refetch it to get the full DeliverTxResponse equivalent
          const finalTx = await client.getTx(txHash);
          broadcastResponse = {
            code: finalTx?.code || 0,
            height: confirmResult.height || 0,
            txIndex: finalTx?.txIndex || 0,
            transactionHash: txHash,
            gasUsed: BigInt(finalTx?.gasUsed || 0),
            gasWanted: BigInt(finalTx?.gasWanted || 0),
            rawLog: finalTx?.rawLog || "Recovered from cache after waiting",
            events: finalTx?.events || [],
            msgResponses: [],
          };
        } else {
          return {
            txHash,
            success: false,
            error: "Transaction was stuck in mempool cache but never confirmed in a block",
            broadcastEndpoint: primaryEndpoint.url,
            verifications: [],
          };
        }
      } else {
        return {
          txHash,
          success: false,
          error: errorMsg,
          broadcastEndpoint: primaryEndpoint.url,
          verifications: [],
        };
      }
    }

    // Check if broadcast was rejected
    if (broadcastResponse.code !== 0) {
      return {
        txHash: broadcastResponse.transactionHash,
        success: false,
        error: broadcastResponse.rawLog || `Transaction failed with code ${broadcastResponse.code}`,
        height: broadcastResponse.height,
        gasUsed: Number(broadcastResponse.gasUsed),
        gasWanted: Number(broadcastResponse.gasWanted),
        rawLog: broadcastResponse.rawLog,
        broadcastEndpoint: primaryEndpoint.url,
        verifications: [],
      };
    }

    // Step 2: Verify on secondary endpoints
    const verifications = await this.verifyInclusion(
      broadcastResponse.transactionHash,
      this.config.minConfirmations,
    );

    const confirmedCount = verifications.filter((v) => v.verified).length + 1; // +1 for primary
    const isFullyVerified = confirmedCount >= this.config.minConfirmations;

    console.log(`🔍 Verification: ${confirmedCount}/${this.config.minConfirmations} confirmations`);

    return {
      txHash: broadcastResponse.transactionHash,
      success: isFullyVerified,
      height: broadcastResponse.height,
      gasUsed: Number(broadcastResponse.gasUsed),
      gasWanted: Number(broadcastResponse.gasWanted),
      rawLog: broadcastResponse.rawLog,
      broadcastEndpoint: primaryEndpoint.url,
      verifications,
    };
  }

  /**
   * Verify transaction inclusion across multiple endpoints
   */
  async verifyInclusion(
    txHash: string,
    minConfirmations: number,
  ): Promise<readonly VerificationResult[]> {
    const witnessEndpoints = this.getWitnessEndpoints();
    const results: VerificationResult[] = [];

    // Query each witness endpoint
    for (const endpoint of witnessEndpoints) {
      const start = Date.now();
      try {
        const client = await this.getClient(endpoint.url);
        const tx = await client.getTx(txHash);
        const responseTime = Date.now() - start;

        if (tx) {
          results.push({
            endpoint: endpoint.url,
            verified: true,
            height: tx.height,
            responseTimeMs: responseTime,
          });
          console.log(`✅ Verified on ${endpoint.url} at height ${tx.height}`);
        } else {
          results.push({
            endpoint: endpoint.url,
            verified: false,
            error: "Transaction not found",
            responseTimeMs: responseTime,
          });
          console.log(`❓ Not yet on ${endpoint.url}`);
        }
      } catch (error) {
        const responseTime = Date.now() - start;
        results.push({
          endpoint: endpoint.url,
          verified: false,
          error: error instanceof Error ? error.message : "Unknown error",
          responseTimeMs: responseTime,
        });
        console.log(`❌ Error on ${endpoint.url}:`, error);
      }

      // Early exit if we have enough confirmations
      const confirmedCount = results.filter((r) => r.verified).length;
      if (confirmedCount >= minConfirmations - 1) {
        // -1 because primary already confirmed
        break;
      }
    }

    return results;
  }

  /**
   * Verify state changes after transaction
   */
  async verifyStateChange(checks: StateCheck[]): Promise<StateVerificationResult> {
    const results: StateCheckResult[] = [];
    const primaryEndpoint = this.getPrimaryEndpoint();

    if (!primaryEndpoint) {
      return {
        verified: false,
        checks: checks.map((check) => ({
          check,
          result: null,
          matched: false,
          error: "No primary endpoint configured",
        })),
      };
    }

    const client = await this.getClient(primaryEndpoint.url);

    for (const check of checks) {
      try {
        let result: unknown;

        switch (check.type) {
          case "balance": {
            const balance = await client.getBalance(check.address, "ucore");
            result = balance;
            break;
          }
          case "account": {
            const account = await client.getAccount(check.address);
            result = account;
            break;
          }
          default:
            result = null;
        }

        const matched =
          check.expected !== undefined
            ? JSON.stringify(result) === JSON.stringify(check.expected)
            : true;

        results.push({
          check,
          result,
          matched,
        });
      } catch (error) {
        results.push({
          check,
          result: null,
          matched: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      verified: results.every((r) => r.matched && !r.error),
      checks: results,
    };
  }

  /**
   * Wait for transaction confirmation with polling
   */
  async waitForConfirmation(
    txHash: string,
    maxAttempts: number = 10,
    intervalMs: number = 2000,
  ): Promise<{ confirmed: boolean; height?: number }> {
    const primaryEndpoint = this.getPrimaryEndpoint();
    if (!primaryEndpoint) {
      return { confirmed: false };
    }

    const client = await this.getClient(primaryEndpoint.url);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const tx = await client.getTx(txHash);
        if (tx) {
          return { confirmed: true, height: tx.height };
        }
      } catch {
        console.log(`Attempt ${attempt + 1}: Transaction not yet confirmed`);
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return { confirmed: false };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private getPrimaryEndpoint(): RpcEndpoint | undefined {
    return this.config.endpoints.find((e) => e.priority === "primary");
  }

  private getWitnessEndpoints(): RpcEndpoint[] {
    return this.config.endpoints.filter(
      (e) => e.priority === "secondary" || e.priority === "witness",
    );
  }

  private async getClient(url: string): Promise<StargateClient> {
    let client = this.clients.get(url);
    if (!client) {
      client = await StargateClient.connect(url);
      this.clients.set(url, client);
    }
    return client;
  }

  /**
   * Disconnect all clients
   */
  async disconnect(): Promise<void> {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a MultiRpcVerifier from chain info
 */
export function createMultiRpcVerifier(
  chainId: string,
  nodeAddress: string,
  nodeAddresses?: readonly string[],
): MultiRpcVerifier {
  const config = EndpointManager.fromChainInfo(chainId, nodeAddress, nodeAddresses);
  return new MultiRpcVerifier(config);
}

/**
 * Create a MultiRpcVerifier with custom configuration
 */
export function createMultiRpcVerifierWithConfig(config: EndpointConfig): MultiRpcVerifier {
  return new MultiRpcVerifier(config);
}
