/**
 * CW3 Contract Client
 *
 * File: lib/contract/cw3-client.ts
 *
 * Wrapper for CW3 multisig contract queries and executes.
 * This client handles all interactions with CW3-Fixed style contracts.
 *
 * Note: This is a placeholder implementation that will be customized
 * when building the custom contract in later phases.
 */

import { CosmWasmClient, SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";
import {
  CW3Config,
  CW3Proposal,
  CW3Vote,
  CW3ExecuteMsg,
  CW3QueryMsg,
  VoteOption,
  CosmosMsg,
  ThresholdResponse,
  ProposalResponse,
  ProposalListResponse,
  VoteListResponse,
  VoterListResponse,
  CW3FixedInstantiateMsg,
  Expiration,
} from "../multisig/contract-types";

// ============================================================================
// Types
// ============================================================================

export interface CW3ExecuteResult {
  success: boolean;
  txHash: string;
  height?: number;
  gasUsed?: number;
  gasWanted?: number;
  proposalId?: number;
  error?: string;
  rawLog?: string;
}

export interface CW3InstantiateResult {
  success: boolean;
  contractAddress?: string;
  txHash: string;
  error?: string;
}

// ============================================================================
// CW3Client
// ============================================================================

export class CW3Client {
  private readonly nodeAddress: string;
  private readonly contractAddress: string;
  private readonly chainId: string;
  private client: CosmWasmClient | null = null;
  private signingClient: SigningCosmWasmClient | null = null;
  private _senderAddress: string | null = null;
  private _gasMultiplier: "auto" | number = "auto";

  constructor(nodeAddress: string, contractAddress: string, chainId: string) {
    this.nodeAddress = nodeAddress;
    this.contractAddress = contractAddress;
    this.chainId = chainId;
  }

  /**
   * Get the fee parameter for gas estimation.
   * When a numeric multiplier is set, it overrides the default 1.4x.
   */
  private get fee(): "auto" | number {
    return this._gasMultiplier;
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Get or create a CosmWasm client for queries
   */
  private async getClient(): Promise<CosmWasmClient> {
    if (!this.client) {
      this.client = await CosmWasmClient.connect(this.nodeAddress);
    }
    return this.client;
  }

  /**
   * Set a signing client for execute operations.
   * @param client - The signing client
   * @param senderAddress - Explicit sender address (avoids fragile signer extraction)
   * @param gasMultiplier - Chain-specific gas multiplier (e.g. 1.3 for Coreum). Default: "auto" (1.4x)
   */
  setSigningClient(
    client: SigningCosmWasmClient,
    senderAddress?: string,
    gasMultiplier?: number,
  ): void {
    this.signingClient = client;
    if (senderAddress) {
      this._senderAddress = senderAddress;
    }
    if (gasMultiplier !== undefined) {
      this._gasMultiplier = gasMultiplier;
    }
  }

  /**
   * Get the signing client (throws if not set)
   */
  private getSigningClient(): SigningCosmWasmClient {
    if (!this.signingClient) {
      throw new Error(
        "Signing client not set. Call setSigningClient() before executing transactions.",
      );
    }
    return this.signingClient;
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  /**
   * Query the contract configuration.
   * Attempts to resolve max_voting_period from the contract rather than
   * hardcoding it:
   *   1. Try the non-standard `config {}` query (supported by many CW3 impls)
   *   2. Fall back to 604800s (7 days) if unavailable
   */
  async queryConfig(): Promise<CW3Config> {
    const client = await this.getClient();

    // Query threshold
    const threshold = (await client.queryContractSmart(this.contractAddress, {
      threshold: {},
    })) as ThresholdResponse;

    // Query voters
    const votersResponse = (await client.queryContractSmart(this.contractAddress, {
      list_voters: {},
    })) as VoterListResponse;

    // Try to get max_voting_period from the contract
    const maxVotingPeriod = await this.queryMaxVotingPeriod(client);

    return {
      threshold,
      max_voting_period: maxVotingPeriod,
      voters: votersResponse.voters,
    };
  }

  /**
   * Attempt to query the max_voting_period from the contract.
   * Strategy:
   *   1. Try `config {}` query (many CW3-Fixed implementations support this)
   *   2. Fall back to 604800s (7 days) default
   */
  private async queryMaxVotingPeriod(
    client: CosmWasmClient,
  ): Promise<{ time?: number; height?: number }> {
    const DEFAULT_VOTING_PERIOD = { time: 604800 };

    // Attempt 1: Try the `config` query supported by cw-plus CW3 contracts
    try {
      const config = (await client.queryContractSmart(this.contractAddress, { config: {} })) as {
        max_voting_period?: { time?: number; height?: number };
      };

      if (config?.max_voting_period) {
        return config.max_voting_period;
      }
    } catch {
      // config query not supported by this contract — expected for some impls
    }

    // Attempt 2: Try to infer from the most recent proposal's expiration
    try {
      const proposals = await this.queryReverseProposals(undefined, 1);
      if (proposals.length > 0) {
        const proposal = proposals[0];
        if (proposal.expires?.at_time) {
          // The proposal expires at a specific nanosecond timestamp.
          // Query the proposal's creation block to compute the delta.
          const fullProposal = (await client.queryContractSmart(this.contractAddress, {
            proposal: { proposal_id: proposal.id },
          })) as ProposalResponse & { open_time?: string };

          // Some CW3 implementations include open_time; if not available,
          // we can't infer the voting period from this proposal alone.
          if (fullProposal.open_time) {
            const openNs = parseInt(fullProposal.open_time, 10);
            const expiresNs = parseInt(proposal.expires.at_time, 10);
            const durationSeconds = Math.round((expiresNs - openNs) / 1_000_000_000);
            if (durationSeconds > 0 && durationSeconds < 365 * 86400) {
              return { time: durationSeconds };
            }
          }
        }
      }
    } catch {
      // inference failed — use default
    }

    return DEFAULT_VOTING_PERIOD;
  }

  /**
   * Query a specific proposal
   */
  async queryProposal(proposalId: number): Promise<CW3Proposal | null> {
    try {
      const client = await this.getClient();
      const response = (await client.queryContractSmart(this.contractAddress, {
        proposal: { proposal_id: proposalId },
      })) as ProposalResponse;

      return {
        id: response.id,
        title: response.title,
        description: response.description,
        msgs: response.msgs,
        status: response.status,
        expires: response.expires,
        threshold: response.threshold,
        proposer: response.proposer,
        deposit: response.deposit,
      };
    } catch {
      // Proposal not found
      return null;
    }
  }

  /**
   * Query list of proposals with pagination
   */
  async queryListProposals(startAfter?: number, limit: number = 30): Promise<CW3Proposal[]> {
    const client = await this.getClient();
    const query: CW3QueryMsg = {
      list_proposals: {
        start_after: startAfter,
        limit,
      },
    };

    const response = (await client.queryContractSmart(
      this.contractAddress,
      query,
    )) as ProposalListResponse;

    return response.proposals.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      msgs: p.msgs,
      status: p.status,
      expires: p.expires,
      threshold: p.threshold,
      proposer: p.proposer,
      deposit: p.deposit,
    }));
  }

  /**
   * Query proposals in reverse order (newest first)
   */
  async queryReverseProposals(startBefore?: number, limit: number = 30): Promise<CW3Proposal[]> {
    const client = await this.getClient();
    const query: CW3QueryMsg = {
      reverse_proposals: {
        start_before: startBefore,
        limit,
      },
    };

    const response = (await client.queryContractSmart(
      this.contractAddress,
      query,
    )) as ProposalListResponse;

    return response.proposals.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      msgs: p.msgs,
      status: p.status,
      expires: p.expires,
      threshold: p.threshold,
      proposer: p.proposer,
      deposit: p.deposit,
    }));
  }

  /**
   * Query votes for a proposal
   */
  async queryVotes(
    proposalId: number,
    startAfter?: string,
    limit: number = 100,
  ): Promise<CW3Vote[]> {
    const client = await this.getClient();
    const query: CW3QueryMsg = {
      list_votes: {
        proposal_id: proposalId,
        start_after: startAfter,
        limit,
      },
    };

    const response = (await client.queryContractSmart(
      this.contractAddress,
      query,
    )) as VoteListResponse;

    return response.votes.map((v) => ({
      voter: v.voter,
      vote: v.vote,
      weight: v.weight,
    }));
  }

  /**
   * Query a specific voter
   */
  async queryVoter(address: string): Promise<{ weight: number } | null> {
    try {
      const client = await this.getClient();
      const response = await client.queryContractSmart(this.contractAddress, {
        voter: { address },
      });
      return response;
    } catch {
      return null;
    }
  }

  /**
   * Query all voters
   */
  async queryListVoters(
    startAfter?: string,
    limit: number = 100,
  ): Promise<{ addr: string; weight: number }[]> {
    const client = await this.getClient();
    const query: CW3QueryMsg = {
      list_voters: {
        start_after: startAfter,
        limit,
      },
    };

    const response = (await client.queryContractSmart(
      this.contractAddress,
      query,
    )) as VoterListResponse;

    return response.voters;
  }

  // ============================================================================
  // Execute Methods
  // ============================================================================

  /**
   * Create a new proposal
   */
  async propose(
    title: string,
    description: string,
    msgs: CosmosMsg[],
    latest?: Expiration,
  ): Promise<CW3ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW3ExecuteMsg = {
        propose: {
          title,
          description,
          msgs,
          latest,
        },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      // Extract proposal_id from events
      const proposalId = this.extractProposalIdFromEvents(result.events);

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
        proposalId,
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Vote on a proposal
   */
  async vote(proposalId: number, vote: VoteOption): Promise<CW3ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW3ExecuteMsg = {
        vote: {
          proposal_id: proposalId,
          vote,
        },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute a passed proposal
   */
  async execute(proposalId: number): Promise<CW3ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW3ExecuteMsg = {
        execute: {
          proposal_id: proposalId,
        },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
        rawLog: error instanceof Error ? error.message : undefined,
      };
    }
  }

  /**
   * Close a rejected/expired proposal
   */
  async close(proposalId: number): Promise<CW3ExecuteResult> {
    try {
      const client = this.getSigningClient();
      const senderAddress = await this.getSenderAddress();

      const executeMsg: CW3ExecuteMsg = {
        close: {
          proposal_id: proposalId,
        },
      };

      const result = await client.execute(
        senderAddress,
        this.contractAddress,
        executeMsg,
        this.fee,
      );

      return {
        success: true,
        txHash: result.transactionHash,
        height: result.height,
        gasUsed: Number(result.gasUsed),
        gasWanted: Number(result.gasWanted),
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Message Builders (for external signing flows)
  // ============================================================================

  /**
   * Build a propose message (for signing externally)
   */
  buildProposeMsg(
    title: string,
    description: string,
    msgs: CosmosMsg[],
    latest?: Expiration,
  ): CW3ExecuteMsg {
    return {
      propose: {
        title,
        description,
        msgs,
        latest,
      },
    };
  }

  /**
   * Build a vote message (for signing externally)
   */
  buildVoteMsg(proposalId: number, vote: VoteOption): CW3ExecuteMsg {
    return {
      vote: {
        proposal_id: proposalId,
        vote,
      },
    };
  }

  /**
   * Build an execute message (for signing externally)
   */
  buildExecuteMsg(proposalId: number): CW3ExecuteMsg {
    return {
      execute: {
        proposal_id: proposalId,
      },
    };
  }

  /**
   * Build a close message (for signing externally)
   */
  buildCloseMsg(proposalId: number): CW3ExecuteMsg {
    return {
      close: {
        proposal_id: proposalId,
      },
    };
  }

  // ============================================================================
  // Instantiation (Static)
  // ============================================================================

  /**
   * Instantiate a new CW3-Fixed multisig contract
   * @param gasMultiplier - Chain-specific gas multiplier. Default: "auto" (1.4x)
   */
  static async instantiate(
    signingClient: SigningCosmWasmClient,
    senderAddress: string,
    codeId: number,
    voters: { addr: string; weight: number }[],
    threshold: number,
    maxVotingPeriodSeconds: number,
    label: string,
    admin?: string,
    gasMultiplier: "auto" | number = "auto",
  ): Promise<CW3InstantiateResult> {
    try {
      const instantiateMsg: CW3FixedInstantiateMsg = {
        voters,
        threshold: {
          absolute_count: {
            weight: threshold,
          },
        },
        max_voting_period: {
          time: maxVotingPeriodSeconds,
        },
      };

      const result = await signingClient.instantiate(
        senderAddress,
        codeId,
        instantiateMsg,
        label,
        gasMultiplier,
        { admin },
      );

      return {
        success: true,
        contractAddress: result.contractAddress,
        txHash: result.transactionHash,
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Instantiate a new CW3-Flex multisig contract.
   * Unlike CW3-Fixed, CW3-Flex references an external CW4-Group contract
   * for membership instead of embedding voters directly.
   * @param gasMultiplier - Chain-specific gas multiplier. Default: "auto" (1.4x)
   */
  static async instantiateFlex(
    signingClient: SigningCosmWasmClient,
    senderAddress: string,
    codeId: number,
    groupAddr: string,
    threshold: number,
    maxVotingPeriodSeconds: number,
    label: string,
    admin?: string,
    gasMultiplier: "auto" | number = "auto",
  ): Promise<CW3InstantiateResult> {
    try {
      const instantiateMsg = {
        group_addr: groupAddr,
        threshold: {
          absolute_count: {
            weight: threshold,
          },
        },
        max_voting_period: {
          time: maxVotingPeriodSeconds,
        },
      };

      const result = await signingClient.instantiate(
        senderAddress,
        codeId,
        instantiateMsg,
        label,
        gasMultiplier,
        { admin },
      );

      return {
        success: true,
        contractAddress: result.contractAddress,
        txHash: result.transactionHash,
      };
    } catch (error) {
      return {
        success: false,
        txHash: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Get the sender address.
   * Uses the explicitly set address first, then falls back to extracting
   * from the signing client's signer.
   */
  private async getSenderAddress(): Promise<string> {
    if (this._senderAddress) {
      return this._senderAddress;
    }

    // Fallback: try to extract from the signing client's internal signer
    const client = this.getSigningClient();
    try {
      const accounts = await (
        client as unknown as {
          signer?: { getAccounts(): Promise<{ address: string }[]> };
        }
      ).signer?.getAccounts();
      if (accounts && accounts.length > 0) {
        this._senderAddress = accounts[0].address;
        return accounts[0].address;
      }
    } catch {
      // Signer extraction failed
    }

    throw new Error(
      "No sender address available. Call setSigningClient(client, senderAddress) or use a factory function.",
    );
  }

  /**
   * Extract proposal_id from transaction events
   */
  private extractProposalIdFromEvents(
    events: readonly { type: string; attributes: readonly { key: string; value: string }[] }[],
  ): number | undefined {
    for (const event of events) {
      if (event.type === "wasm" || event.type === "wasm-propose") {
        for (const attr of event.attributes) {
          if (attr.key === "proposal_id") {
            return parseInt(attr.value, 10);
          }
        }
      }
    }
    return undefined;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Check if a proposal has expired
   */
  isProposalExpired(expires: Expiration): boolean {
    if (expires.never) {
      return false;
    }

    if (expires.at_time) {
      const expiresAt = parseInt(expires.at_time, 10) / 1_000_000; // Convert nanoseconds to milliseconds
      return Date.now() > expiresAt;
    }

    // For height-based expiration, we'd need to query current height
    // This is a simplified implementation
    return false;
  }

  /**
   * Calculate time remaining for a proposal
   */
  getTimeRemaining(expires: Expiration): number | null {
    if (expires.never) {
      return null;
    }

    if (expires.at_time) {
      const expiresAt = parseInt(expires.at_time, 10) / 1_000_000;
      const remaining = expiresAt - Date.now();
      return remaining > 0 ? remaining : 0;
    }

    return null;
  }

  /**
   * Get the contract address
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Get the chain ID
   */
  getChainId(): string {
    return this.chainId;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a CW3 client for queries only
 */
export function createCW3Client(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
): CW3Client {
  return new CW3Client(nodeAddress, contractAddress, chainId);
}

/**
 * Create a CW3 client with signing capabilities from a pre-built client.
 * @param gasMultiplier - Chain-specific gas multiplier (e.g. 1.3 for Coreum). Omit for default 1.4x.
 */
export async function createSigningCW3Client(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
  signingClient: SigningCosmWasmClient,
  senderAddress?: string,
  gasMultiplier?: number,
): Promise<CW3Client> {
  const client = new CW3Client(nodeAddress, contractAddress, chainId);
  client.setSigningClient(signingClient, senderAddress, gasMultiplier);
  return client;
}

/**
 * Create a CW3 client with signing capabilities from a signer and gas price.
 * This is the preferred factory function as it ensures gasPrice is properly
 * configured for gas estimation.
 * @param gasMultiplier - Chain-specific gas multiplier (e.g. 1.3 for Coreum). Omit for default 1.4x.
 */
export async function createSigningCW3ClientFromSigner(
  nodeAddress: string,
  contractAddress: string,
  chainId: string,
  signer: OfflineSigner,
  gasPrice: string,
  gasMultiplier?: number,
): Promise<CW3Client> {
  // Extract sender address from signer before connecting
  const accounts = await signer.getAccounts();
  const senderAddress = accounts[0]?.address;
  if (!senderAddress) {
    throw new Error("Signer has no accounts");
  }

  const signingClient = await SigningCosmWasmClient.connectWithSigner(nodeAddress, signer, {
    gasPrice: GasPrice.fromString(gasPrice),
  });
  const client = new CW3Client(nodeAddress, contractAddress, chainId);
  client.setSigningClient(signingClient, senderAddress, gasMultiplier);
  return client;
}
