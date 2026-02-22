/**
 * ContractMultisigEngine Implementation
 * 
 * File: lib/multisig/contract-engine.ts
 * 
 * This implementation wraps CW3-style contract multisig operations.
 * It provides a unified interface for creating proposals, voting,
 * and executing through on-chain contract state.
 * 
 * Key differences from PubKeyMultisigEngine:
 * - Proposals are stored on-chain (not off-chain)
 * - Approvals are on-chain votes (not signature collection)
 * - Address is stable (key rotation doesn't change address)
 * - State is queried from contract (DB is advisory cache)
 * 
 * Phase 2 additions:
 * - Supports both "fixed" (CW3-Fixed) and "flex" (CW3-Flex) multisig styles
 * - Flex style delegates membership to a GroupProvider (CW4-group or custom)
 * - Dual snapshot semantics for audit-grade tracking
 */

import { sha256 } from "@cosmjs/crypto";
import { toBase64 } from "@cosmjs/encoding";
import { EncodeObject } from "@cosmjs/proto-signing";

import {
  MultisigEngine,
  SignBytesResult,
  EngineConfig,
} from "./engine";
import {
  ApprovalReceipt,
  Member,
  MultisigPolicy,
  Proposal,
  ProposalContent,
  ProposalInput,
  ProposalState,
  RevokeReceipt,
  SignerInfo,
  TxResult,
  MultisigEngineError,
} from "./types";
import {
  CW3Config,
  CW3Proposal,
  CosmosMsg,
  ContractProposalState,
  ContractMultisigPolicy,
  ContractMember,
  ThresholdResponse,
} from "./contract-types";
import { CW3Client } from "../contract/cw3-client";
import { GroupProvider } from "../group/provider";
import { GroupMember } from "../group/types";
import * as localDb from "../localDb";
import {
  PolicyEvaluator,
  PolicyContext,
  PolicyEvaluationResult,
} from "../policies/types";

// ============================================================================
// Contract Engine Configuration
// ============================================================================

/**
 * Multisig style:
 * - fixed: CW3-Fixed (Phase 1)
 * - flex: CW3-Flex with CW4 group (Phase 2)
 * - credential-gated: CW3-Flex with credential verification (Phase 3)
 */
export type MultisigStyle = "fixed" | "flex" | "credential-gated";

/**
 * Credential service interface for dependency injection
 * This avoids circular imports with the credentials module
 */
export interface CredentialVerifier {
  verifyCredential(
    teamAddress: string,
    signerAddress: string,
    requiredRole?: string,
  ): Promise<{
    isValid: boolean;
    reason?: string;
    verifiedAtHeight: number;
    verifiedAt: string;
  }>;
  hasValidCredential(
    teamAddress: string,
    signerAddress: string,
  ): Promise<boolean>;
}

export interface ContractEngineConfig extends EngineConfig {
  /** Optional: code ID used to instantiate the contract */
  readonly codeId?: number;
  /** Optional: label for the contract */
  readonly label?: string;
  /** Multisig style: fixed, flex, or credential-gated (default: fixed) */
  readonly multisigStyle?: MultisigStyle;
  /** Group address for flex-style multisigs */
  readonly groupAddress?: string;
  /** Group provider for flex-style multisigs */
  readonly groupProvider?: GroupProvider;
  /** Credential class ID for credential-gated multisigs (Phase 3) */
  readonly credentialClassId?: string;
  /** Credential verifier for credential-gated multisigs (Phase 3) */
  readonly credentialVerifier?: CredentialVerifier;
  /** Policy evaluator for Phase 4 policy enforcement */
  readonly policyEvaluator?: PolicyEvaluator;
  /** Policy version for the multisig (Phase 4) */
  readonly policyVersion?: number;
}

// ============================================================================
// ContractMultisigEngine
// ============================================================================

export class ContractMultisigEngine implements MultisigEngine {
  readonly engineType = "contract" as const;
  readonly chainId: string;
  readonly multisigAddress: string;

  private readonly nodeAddress: string;
  private readonly nodeAddresses: readonly string[];
  private readonly cw3Client: CW3Client;

  // Phase 2: Flex-style multisig support
  private readonly multisigStyle: MultisigStyle;
  private readonly groupAddress: string | null;
  private readonly groupProvider: GroupProvider | null;

  // Phase 3: Credential-gated multisig support
  private readonly credentialClassId: string | null;
  private readonly credentialVerifier: CredentialVerifier | null;

  // Phase 4: Policy enforcement
  private readonly policyEvaluator: PolicyEvaluator | null;
  private readonly policyVersion: number;

  // Cached config (refreshed on demand)
  private cachedConfig: CW3Config | null = null;
  private configLastFetched: number = 0;
  private readonly configCacheTTL = 60000; // 1 minute

  constructor(config: ContractEngineConfig) {
    this.chainId = config.chainId;
    this.multisigAddress = config.multisigAddress;
    this.nodeAddress = config.nodeAddress;
    this.nodeAddresses = config.nodeAddresses ?? [config.nodeAddress];
    this.cw3Client = new CW3Client(
      config.nodeAddress,
      config.multisigAddress,
      config.chainId,
    );
    
    // Phase 2: Initialize flex-style support
    this.multisigStyle = config.multisigStyle ?? "fixed";
    this.groupAddress = config.groupAddress ?? null;
    this.groupProvider = config.groupProvider ?? null;
    
    // Phase 3: Initialize credential-gated support
    this.credentialClassId = config.credentialClassId ?? null;
    this.credentialVerifier = config.credentialVerifier ?? null;

    // Phase 4: Initialize policy enforcement
    this.policyEvaluator = config.policyEvaluator ?? null;
    this.policyVersion = config.policyVersion ?? 1;
  }

  // ============================================================================
  // Phase 2: Multisig Style Accessors
  // ============================================================================

  /**
   * Get the multisig style (fixed or flex)
   */
  getMultisigStyle(): MultisigStyle {
    return this.multisigStyle;
  }

  /**
   * Check if this is a flex-style multisig
   */
  isFlexStyle(): boolean {
    return this.multisigStyle === "flex";
  }

  /**
   * Get the group address (for flex-style multisigs)
   */
  getGroupAddress(): string | null {
    return this.groupAddress;
  }

  /**
   * Get the group provider (for flex-style multisigs)
   */
  getGroupProvider(): GroupProvider | null {
    return this.groupProvider;
  }

  // ============================================================================
  // Phase 3: Credential-Gated Accessors
  // ============================================================================

  /**
   * Check if this is a credential-gated multisig
   */
  isCredentialGated(): boolean {
    return this.multisigStyle === "credential-gated";
  }

  /**
   * Get the credential class ID (for credential-gated multisigs)
   */
  getCredentialClassId(): string | null {
    return this.credentialClassId;
  }

  /**
   * Get the credential verifier (for credential-gated multisigs)
   */
  getCredentialVerifier(): CredentialVerifier | null {
    return this.credentialVerifier;
  }

  /**
   * Verify a signer's credential
   * 
   * @param signerAddress - Address to verify
   * @param requiredRole - Optional required role
   * @returns Verification result
   */
  async verifySignerCredential(
    signerAddress: string,
    requiredRole?: string,
  ): Promise<{ isValid: boolean; reason?: string }> {
    if (!this.isCredentialGated() || !this.credentialVerifier) {
      // Not credential-gated, always valid
      return { isValid: true };
    }

    const result = await this.credentialVerifier.verifyCredential(
      this.multisigAddress,
      signerAddress,
      requiredRole,
    );

    return {
      isValid: result.isValid,
      reason: result.reason,
    };
  }

  // ============================================================================
  // Phase 4: Policy Enforcement Accessors
  // ============================================================================

  /**
   * Check if policy enforcement is enabled
   */
  hasPolicyEnforcement(): boolean {
    return this.policyEvaluator !== null;
  }

  /**
   * Get the policy evaluator
   */
  getPolicyEvaluator(): PolicyEvaluator | null {
    return this.policyEvaluator;
  }

  /**
   * Get the current policy version
   */
  getPolicyVersion(): number {
    return this.policyVersion;
  }

  /**
   * Build policy context for evaluation
   * This collects all necessary information for policy decisions
   */
  async buildPolicyContext(
    proposal: Proposal,
    additionalContext?: Partial<PolicyContext>,
  ): Promise<PolicyContext> {
    // Get current config for threshold info
    const config = await this.getConfig();
    const threshold = this.extractThreshold(config.threshold);
    const totalWeight = config.voters.reduce((sum, v) => sum + v.weight, 0);

    // Extract recipient addresses from messages
    const recipientAddresses = this.extractRecipientAddresses(proposal.content.msgs);

    // Extract message types
    const messageTypes = proposal.content.msgs.map((m) => m.typeUrl);

    // Calculate proposal value
    const proposalValue = this.extractProposalValue(proposal.content.msgs);

    return {
      // Credential context (from additional context or defaults)
      signerRoles: additionalContext?.signerRoles ?? [],
      credentialVersions: additionalContext?.credentialVersions ?? new Map(),
      minRequiredVersion: additionalContext?.minRequiredVersion ?? 0,

      // Spend context
      spentInWindow: additionalContext?.spentInWindow ?? new Map(),
      proposalValue,
      treasuryBalance: additionalContext?.treasuryBalance ?? [],

      // Recipient context
      recipientAddresses,

      // Message context
      messageTypes: messageTypes as PolicyContext["messageTypes"],
      messages: proposal.content.msgs,

      // Timing context
      queuedAt: additionalContext?.queuedAt ?? null,
      timeSinceQueue: additionalContext?.timeSinceQueue ?? 0,
      currentHeight: additionalContext?.currentHeight ?? 0,
      currentTimestamp: additionalContext?.currentTimestamp ?? Math.floor(Date.now() / 1000),

      // Emergency context
      isPaused: additionalContext?.isPaused ?? false,
      isSafeMode: additionalContext?.isSafeMode ?? false,
      elevatedThreshold: additionalContext?.elevatedThreshold ?? null,
      normalThreshold: threshold,

      // Multisig context
      multisigAddress: this.multisigAddress,
      chainId: this.chainId,
      policyVersion: this.policyVersion,
    };
  }

  /**
   * Evaluate policies for proposal creation
   */
  async evaluatePoliciesForProposal(
    proposal: Proposal,
    additionalContext?: Partial<PolicyContext>,
  ): Promise<PolicyEvaluationResult | null> {
    if (!this.policyEvaluator) {
      return null;
    }

    const context = await this.buildPolicyContext(proposal, additionalContext);
    return this.policyEvaluator.evaluateProposal(proposal, context);
  }

  /**
   * Evaluate policies for proposal execution
   */
  async evaluatePoliciesForExecution(
    proposal: Proposal,
    additionalContext?: Partial<PolicyContext>,
  ): Promise<PolicyEvaluationResult | null> {
    if (!this.policyEvaluator) {
      return null;
    }

    const context = await this.buildPolicyContext(proposal, additionalContext);
    return this.policyEvaluator.evaluateExecution(proposal, context);
  }

  /**
   * Extract recipient addresses from messages
   */
  private extractRecipientAddresses(msgs: readonly EncodeObject[]): string[] {
    const recipients: string[] = [];

    for (const msg of msgs) {
      // Handle common message types
      if (msg.typeUrl === "/cosmos.bank.v1beta1.MsgSend") {
        const value = msg.value as { toAddress?: string };
        if (value.toAddress) {
          recipients.push(value.toAddress);
        }
      } else if (msg.typeUrl === "/ibc.applications.transfer.v1.MsgTransfer") {
        const value = msg.value as { receiver?: string };
        if (value.receiver) {
          recipients.push(value.receiver);
        }
      } else if (msg.typeUrl === "/cosmos.staking.v1beta1.MsgDelegate") {
        const value = msg.value as { validatorAddress?: string };
        if (value.validatorAddress) {
          recipients.push(value.validatorAddress);
        }
      } else if (msg.typeUrl === "/cosmwasm.wasm.v1.MsgExecuteContract") {
        const value = msg.value as { contract?: string };
        if (value.contract) {
          recipients.push(value.contract);
        }
      }
      // Add more message types as needed
    }

    return recipients;
  }

  /**
   * Extract total value from messages
   */
  private extractProposalValue(msgs: readonly EncodeObject[]): { denom: string; amount: string }[] {
    const valueMap = new Map<string, bigint>();

    for (const msg of msgs) {
      let amounts: { denom: string; amount: string }[] = [];

      if (msg.typeUrl === "/cosmos.bank.v1beta1.MsgSend") {
        const value = msg.value as { amount?: { denom: string; amount: string }[] };
        amounts = value.amount ?? [];
      } else if (msg.typeUrl === "/ibc.applications.transfer.v1.MsgTransfer") {
        const value = msg.value as { token?: { denom: string; amount: string } };
        if (value.token) {
          amounts = [value.token];
        }
      } else if (msg.typeUrl === "/cosmos.staking.v1beta1.MsgDelegate") {
        const value = msg.value as { amount?: { denom: string; amount: string } };
        if (value.amount) {
          amounts = [value.amount];
        }
      }

      for (const coin of amounts) {
        const current = valueMap.get(coin.denom) ?? BigInt(0);
        valueMap.set(coin.denom, current + BigInt(coin.amount));
      }
    }

    return Array.from(valueMap.entries()).map(([denom, amount]) => ({
      denom,
      amount: amount.toString(),
    }));
  }

  // ============================================================================
  // Proposal Lifecycle
  // ============================================================================

  /**
   * Create a new proposal on the contract
   * 
   * Note: For contract multisig, we need to submit a tx to create the proposal.
   * This method builds the propose message - the actual tx must be signed and
   * broadcast by the caller.
   * 
   * Phase 2: For flex-style multisigs, captures member snapshot at proposal creation
   */
  async createProposal(input: ProposalInput, policyContext?: Partial<PolicyContext>): Promise<Proposal> {
    // Phase 4: Pre-validate against policies before creating proposal
    if (this.policyEvaluator) {
      // Create a draft proposal for policy evaluation
      const draftProposal: Proposal = {
        id: "draft",
        multisigAddress: this.multisigAddress,
        chainId: this.chainId,
        payloadHash: "",
        content: {
          msgs: input.msgs,
          fee: input.fee,
          memo: input.memo ?? "",
          chainId: this.chainId,
          accountNumber: input.accountNumber,
          sequence: input.sequence,
        },
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const policyResult = await this.evaluatePoliciesForProposal(draftProposal, policyContext);
      
      if (policyResult && !policyResult.allowed) {
        const violationMessages = policyResult.violations
          .map((v) => `${v.policyType}: ${v.message}`)
          .join("; ");
        
        throw new MultisigEngineError(
          `Proposal violates policies: ${violationMessages}`,
          "PROPOSAL_NOT_PENDING",
          { violations: policyResult.violations },
        );
      }
    }

    // For contract multisig, we convert EncodeObjects to CosmosMsg format
    const contractMsgs = this.encodeObjectsToCosmosMsg(input.msgs);

    // Create proposal on-chain
    const result = await this.cw3Client.propose(
      "Multisig Proposal", // Default title - can be enhanced
      input.memo || "Proposal created via Cliq",
      contractMsgs,
    );

    if (!result.success) {
      throw new MultisigEngineError(
        `Failed to create proposal: ${result.error}`,
        "CONTRACT_EXECUTE_FAILED",
        { rawLog: result.rawLog },
      );
    }

    const proposalId = result.proposalId?.toString() || result.txHash;
    const numericProposalId = result.proposalId ?? parseInt(proposalId, 10);

    // Phase 2: Capture member snapshot for flex-style multisigs
    if (this.isFlexStyle() && this.groupProvider) {
      await this.captureMemberSnapshot(numericProposalId);
    }

    const content: ProposalContent = {
      msgs: input.msgs,
      fee: input.fee,
      memo: input.memo ?? "",
      chainId: this.chainId,
      accountNumber: input.accountNumber,
      sequence: input.sequence,
    };

    const payloadHash = this.computePayloadHash(content);

    return {
      id: proposalId,
      multisigAddress: this.multisigAddress,
      chainId: this.chainId,
      payloadHash,
      content,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Vote on a proposal (approve = vote yes)
   * 
   * For contract multisig, approval is an on-chain vote transaction
   * 
   * Phase 3: For credential-gated multisigs, verifies credential before voting
   */
  async approveProposal(
    proposalId: string,
    signer: SignerInfo,
    _signatureBytes: string, // Not used for contract multisig
    _signDocHash: string, // Not used for contract multisig
  ): Promise<ApprovalReceipt> {
    const numericProposalId = parseInt(proposalId, 10);
    
    // Phase 3: Verify credential for credential-gated multisigs
    if (this.isCredentialGated() && this.credentialVerifier) {
      const credentialResult = await this.credentialVerifier.verifyCredential(
        this.multisigAddress,
        signer.address,
        "member", // Require at least member role to vote
      );

      if (!credentialResult.isValid) {
        throw new MultisigEngineError(
          `Signer ${signer.address} does not hold a valid credential: ${credentialResult.reason || "unknown"}`,
          "CREDENTIAL_REQUIRED",
          { reason: credentialResult.reason },
        );
      }
    }
    
    // Verify the proposal exists and is open
    const proposal = await this.cw3Client.queryProposal(numericProposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    if (proposal.status !== "pending" && proposal.status !== "open") {
      throw new MultisigEngineError(
        `Proposal ${proposalId} is not open for voting`,
        "VOTING_CLOSED",
      );
    }

    // Check if already voted
    const existingVotes = await this.cw3Client.queryVotes(numericProposalId);
    if (existingVotes.some((v) => v.voter === signer.address)) {
      throw new MultisigEngineError(
        `${signer.address} has already voted on this proposal`,
        "ALREADY_VOTED",
      );
    }

    // Submit vote
    const result = await this.cw3Client.vote(numericProposalId, "yes");

    if (!result.success) {
      throw new MultisigEngineError(
        `Failed to vote: ${result.error}`,
        "CONTRACT_EXECUTE_FAILED",
        { rawLog: result.rawLog },
      );
    }

    // Phase 2: Capture vote snapshot for audit trail
    await this.captureVoteSnapshot(numericProposalId, signer.address, result.height ?? 0);

    // Get updated state
    const updatedProposal = await this.cw3Client.queryProposal(numericProposalId);
    const yesWeight = await this.calculateYesWeight(numericProposalId);
    const config = await this.getConfig();
    const threshold = this.extractThreshold(config.threshold);

    return {
      proposalId,
      signerAddress: signer.address,
      signDocHash: result.txHash, // Use tx hash as reference
      signatureBytes: "", // Not applicable for contract multisig
      timestamp: new Date().toISOString(),
      newApprovalWeight: yesWeight,
      isReady: yesWeight >= threshold || updatedProposal?.status === "passed",
    };
  }

  /**
   * Revoke vote from a proposal
   * 
   * Note: Standard CW3 contracts don't support vote revocation.
   * This is a placeholder for custom contracts that may support it.
   */
  async revokeApproval(
    proposalId: string,
    _signer: SignerInfo,
  ): Promise<RevokeReceipt> {
    throw new MultisigEngineError(
      "Vote revocation is not supported by CW3 contracts",
      "VOTING_CLOSED",
      { proposalId },
    );
  }

  /**
   * Execute a passed proposal
   * 
   * Phase 3: For credential-gated multisigs, verifies executor credential
   * 
   * @param proposalId - Proposal to execute
   * @param executorAddress - Optional: address of the executor (for credential check)
   */
  async executeProposal(proposalId: string, executorAddress?: string): Promise<TxResult> {
    const numericProposalId = parseInt(proposalId, 10);

    // Phase 3: Verify credential for credential-gated multisigs
    if (this.isCredentialGated() && this.credentialVerifier && executorAddress) {
      const credentialResult = await this.credentialVerifier.verifyCredential(
        this.multisigAddress,
        executorAddress,
        "executor", // Prefer executor role, but member can execute too
      );

      // Fall back to checking member role if executor role not found
      if (!credentialResult.isValid && credentialResult.reason === "wrong_role") {
        const memberResult = await this.credentialVerifier.verifyCredential(
          this.multisigAddress,
          executorAddress,
          "member",
        );
        
        if (!memberResult.isValid) {
          throw new MultisigEngineError(
            `Executor ${executorAddress} does not hold a valid credential: ${memberResult.reason || "unknown"}`,
            "CREDENTIAL_REQUIRED",
            { reason: memberResult.reason },
          );
        }
      } else if (!credentialResult.isValid) {
        throw new MultisigEngineError(
          `Executor ${executorAddress} does not hold a valid credential: ${credentialResult.reason || "unknown"}`,
          "CREDENTIAL_REQUIRED",
          { reason: credentialResult.reason },
        );
      }
    }

    // Verify proposal has passed
    const proposal = await this.cw3Client.queryProposal(numericProposalId);

    // Phase 4: Evaluate policies before execution
    if (this.policyEvaluator && proposal) {
      // Get stored proposal to build context
      const storedProposal = localDb.getContractProposal(this.multisigAddress, numericProposalId);
      
      if (storedProposal) {
        // Build a Proposal object for policy evaluation
        const proposalForPolicy: Proposal = {
          id: proposalId,
          multisigAddress: this.multisigAddress,
          chainId: this.chainId,
          payloadHash: "",
          content: {
            msgs: JSON.parse(storedProposal.msgsJSON),
            fee: { amount: [], gas: "0" },
            memo: storedProposal.description,
            chainId: this.chainId,
            accountNumber: 0,
            sequence: 0,
          },
          status: storedProposal.status === "passed" ? "ready" : "pending",
          createdAt: storedProposal.createdAt,
          updatedAt: storedProposal.updatedAt,
        };

        // Calculate time since queue for timelock enforcement
        const queuedAt = storedProposal.createdAt 
          ? Math.floor(new Date(storedProposal.createdAt).getTime() / 1000)
          : null;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const timeSinceQueue = queuedAt ? currentTimestamp - queuedAt : 0;

        const policyResult = await this.evaluatePoliciesForExecution(proposalForPolicy, {
          queuedAt,
          timeSinceQueue,
          currentTimestamp,
        });
        
        if (policyResult && !policyResult.allowed) {
          const violationMessages = policyResult.violations
            .map((v) => `${v.policyType}: ${v.message}`)
            .join("; ");
          
          throw new MultisigEngineError(
            `Execution blocked by policies: ${violationMessages}`,
            "PROPOSAL_NOT_PASSED",
            { violations: policyResult.violations },
          );
        }
      }
    }
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    if (proposal.status !== "passed") {
      throw new MultisigEngineError(
        `Proposal ${proposalId} has not passed (status: ${proposal.status})`,
        "PROPOSAL_NOT_PASSED",
      );
    }

    // Execute
    const result = await this.cw3Client.execute(numericProposalId);

    return {
      proposalId,
      txHash: result.txHash,
      height: result.height || 0,
      gasUsed: result.gasUsed || 0,
      gasWanted: result.gasWanted || 0,
      success: result.success,
      rawLog: result.rawLog,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cancel a proposal (close it)
   * 
   * Note: CW3 uses "close" for expired/rejected proposals
   */
  async cancelProposal(proposalId: string): Promise<void> {
    const numericProposalId = parseInt(proposalId, 10);

    const result = await this.cw3Client.close(numericProposalId);

    if (!result.success) {
      throw new MultisigEngineError(
        `Failed to close proposal: ${result.error}`,
        "CONTRACT_EXECUTE_FAILED",
        { rawLog: result.rawLog },
      );
    }
  }

  // ============================================================================
  // Queries
  // ============================================================================

  async getProposal(proposalId: string): Promise<ProposalState> {
    const numericProposalId = parseInt(proposalId, 10);
    const proposal = await this.cw3Client.queryProposal(numericProposalId);

    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    return this.contractProposalToProposalState(proposal, numericProposalId);
  }

  async listProposals(status?: string): Promise<readonly ProposalState[]> {
    const proposals = await this.cw3Client.queryListProposals();

    let filtered = proposals;
    if (status) {
      filtered = proposals.filter((p) => this.mapContractStatus(p.status) === status);
    }

    return Promise.all(
      filtered.map((p) => this.contractProposalToProposalState(p, p.id)),
    );
  }

  async getPolicy(): Promise<MultisigPolicy> {
    const config = await this.getConfig();
    const threshold = this.extractThreshold(config.threshold);
    const totalWeight = config.voters.reduce((sum, v) => sum + v.weight, 0);

    return {
      threshold,
      totalWeight,
      signModes: ["direct"], // Contract multisig uses direct mode
      version: 1, // Could be derived from contract state
    };
  }

  async listMembers(): Promise<readonly Member[]> {
    // Phase 2: For flex-style multisigs, get members from group provider
    if (this.isFlexStyle() && this.groupProvider) {
      const groupMembers = await this.groupProvider.listMembers();
      return groupMembers.map((m: GroupMember) => ({
        address: m.address,
        pubkey: "", // Contract multisig doesn't require pubkeys
        weight: m.weight,
      }));
    }

    // Fixed style: get members from CW3 contract config
    const config = await this.getConfig();

    return config.voters.map((v) => ({
      address: v.addr,
      pubkey: "", // Contract multisig doesn't require pubkeys
      weight: v.weight,
    }));
  }

  // ============================================================================
  // Signing Helpers (Different for Contract Multisig)
  // ============================================================================

  /**
   * Get sign bytes for voting on a proposal
   * 
   * For contract multisig, the "sign bytes" is the vote execute message
   */
  async getSignBytes(
    proposalId: string,
    _signMode: "amino" | "direct",
  ): Promise<SignBytesResult> {
    const numericProposalId = parseInt(proposalId, 10);
    const proposal = await this.cw3Client.queryProposal(numericProposalId);

    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    // For contract multisig, we return the vote message as sign bytes
    const voteMsg = this.cw3Client.buildVoteMsg(numericProposalId, "yes");
    const signBytes = new TextEncoder().encode(JSON.stringify(voteMsg));
    const signDocHash = sha256(signBytes);

    return {
      signBytes,
      signDocHash: toBase64(signDocHash),
      bodyBytes: signBytes,
      signMode: "direct",
      summary: {
        actions: [{
          type: "Vote",
          description: `Vote Yes on proposal #${proposalId}`,
          details: {
            proposal_id: proposalId,
            vote: "yes",
          },
        }],
        fee: "Gas fees determined by wallet",
        memo: proposal.description,
      },
    };
  }

  /**
   * Verify a vote exists on-chain
   */
  async verifySignature(
    proposalId: string,
    signerAddress: string,
    _signatureBytes: string,
    _signDocHash: string,
  ): Promise<boolean> {
    const numericProposalId = parseInt(proposalId, 10);
    const votes = await this.cw3Client.queryVotes(numericProposalId);
    return votes.some((v) => v.voter === signerAddress);
  }

  // ============================================================================
  // Contract-Specific Methods
  // ============================================================================

  /**
   * Get the contract configuration
   */
  async getConfig(): Promise<CW3Config> {
    const now = Date.now();
    if (this.cachedConfig && now - this.configLastFetched < this.configCacheTTL) {
      return this.cachedConfig;
    }

    const config = await this.cw3Client.queryConfig();
    this.cachedConfig = config;
    this.configLastFetched = now;
    return config;
  }

  /**
   * Get detailed proposal state (contract-specific)
   */
  async getContractProposalState(proposalId: number): Promise<ContractProposalState> {
    const proposal = await this.cw3Client.queryProposal(proposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    const votes = await this.cw3Client.queryVotes(proposalId);
    const config = await this.getConfig();
    const threshold = this.extractThreshold(config.threshold);

    const yesWeight = votes.filter((v) => v.vote === "yes").reduce((sum, v) => sum + v.weight, 0);
    const noWeight = votes.filter((v) => v.vote === "no").reduce((sum, v) => sum + v.weight, 0);
    const abstainWeight = votes.filter((v) => v.vote === "abstain").reduce((sum, v) => sum + v.weight, 0);
    const vetoWeight = votes.filter((v) => v.vote === "veto").reduce((sum, v) => sum + v.weight, 0);

    return {
      id: proposalId,
      contractAddress: this.multisigAddress,
      chainId: this.chainId,
      title: proposal.title,
      description: proposal.description,
      msgs: proposal.msgs,
      status: proposal.status,
      expires: proposal.expires,
      threshold: proposal.threshold,
      proposer: proposal.proposer,
      votes: votes,
      yesWeight,
      noWeight,
      abstainWeight,
      vetoWeight,
      isReady: yesWeight >= threshold || proposal.status === "passed",
      lastVerifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Get contract members with weights
   */
  async getContractMembers(): Promise<ContractMember[]> {
    const config = await this.getConfig();
    return config.voters.map((v) => ({
      address: v.addr,
      weight: v.weight,
    }));
  }

  /**
   * Get contract multisig policy
   */
  async getContractPolicy(): Promise<ContractMultisigPolicy> {
    const config = await this.getConfig();
    const threshold = this.extractThreshold(config.threshold);
    const totalWeight = config.voters.reduce((sum, v) => sum + v.weight, 0);
    const maxVotingPeriodSeconds = config.max_voting_period.time || 0;

    return {
      threshold,
      totalWeight,
      maxVotingPeriodSeconds,
      version: 1,
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private computePayloadHash(content: ProposalContent): string {
    const canonical = JSON.stringify({
      chainId: content.chainId,
      accountNumber: content.accountNumber,
      sequence: content.sequence,
      msgs: content.msgs.map((m) => ({
        typeUrl: m.typeUrl,
        value: m.value,
      })),
      fee: content.fee,
      memo: content.memo,
    });

    const hash = sha256(new TextEncoder().encode(canonical));
    return toBase64(hash);
  }

  private encodeObjectsToCosmosMsg(msgs: readonly EncodeObject[]): CosmosMsg[] {
    return msgs.map((msg) => {
      // Convert EncodeObject to CosmosMsg format
      // This is a simplified conversion - full implementation would handle all msg types
      switch (msg.typeUrl) {
        case "/cosmos.bank.v1beta1.MsgSend":
          return {
            bank: {
              send: {
                to_address: msg.value.toAddress,
                amount: msg.value.amount,
              },
            },
          };
        case "/cosmos.staking.v1beta1.MsgDelegate":
          return {
            staking: {
              delegate: {
                validator: msg.value.validatorAddress,
                amount: msg.value.amount,
              },
            },
          };
        case "/cosmos.staking.v1beta1.MsgUndelegate":
          return {
            staking: {
              undelegate: {
                validator: msg.value.validatorAddress,
                amount: msg.value.amount,
              },
            },
          };
        case "/cosmwasm.wasm.v1.MsgExecuteContract":
          return {
            wasm: {
              execute: {
                contract_addr: msg.value.contract,
                msg: toBase64(new TextEncoder().encode(JSON.stringify(msg.value.msg))),
                funds: msg.value.funds || [],
              },
            },
          };
        default:
          // Use stargate for unknown types
          return {
            stargate: {
              type_url: msg.typeUrl,
              value: toBase64(new TextEncoder().encode(JSON.stringify(msg.value))),
            },
          };
      }
    });
  }

  private extractThreshold(threshold: ThresholdResponse): number {
    if (threshold.absolute_count) {
      return threshold.absolute_count.weight;
    }
    if (threshold.absolute_percentage) {
      // Convert percentage to weight (simplified)
      return Math.ceil(parseFloat(threshold.absolute_percentage.percentage) * threshold.absolute_percentage.total_weight);
    }
    if (threshold.threshold_quorum) {
      return Math.ceil(parseFloat(threshold.threshold_quorum.threshold) * threshold.threshold_quorum.total_weight);
    }
    return 1;
  }

  private async calculateYesWeight(proposalId: number): Promise<number> {
    const votes = await this.cw3Client.queryVotes(proposalId);
    return votes.filter((v) => v.vote === "yes").reduce((sum, v) => sum + v.weight, 0);
  }

  private mapContractStatus(status: string): string {
    switch (status) {
      case "pending":
      case "open":
        return "pending";
      case "passed":
        return "ready";
      case "rejected":
        return "failed";
      case "executed":
        return "confirmed";
      default:
        return status;
    }
  }

  private async contractProposalToProposalState(
    proposal: CW3Proposal,
    proposalId: number,
  ): Promise<ProposalState> {
    const votes = await this.cw3Client.queryVotes(proposalId);
    const config = await this.getConfig();
    const threshold = this.extractThreshold(config.threshold);
    const yesWeight = votes.filter((v) => v.vote === "yes").reduce((sum, v) => sum + v.weight, 0);

    // Convert CosmosMsg back to EncodeObject (simplified)
    const encodeObjects: EncodeObject[] = proposal.msgs.map((msg) => {
      if (msg.bank?.send) {
        return {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: this.multisigAddress,
            toAddress: msg.bank.send.to_address,
            amount: msg.bank.send.amount,
          },
        };
      }
      if (msg.staking?.delegate) {
        return {
          typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
          value: {
            delegatorAddress: this.multisigAddress,
            validatorAddress: msg.staking.delegate.validator,
            amount: msg.staking.delegate.amount,
          },
        };
      }
      if (msg.wasm?.execute) {
        return {
          typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
          value: {
            sender: this.multisigAddress,
            contract: msg.wasm.execute.contract_addr,
            msg: msg.wasm.execute.msg,
            funds: msg.wasm.execute.funds,
          },
        };
      }
      // Fallback for stargate messages
      return {
        typeUrl: msg.stargate?.type_url || "unknown",
        value: msg.stargate?.value || {},
      };
    });

    const content: ProposalContent = {
      msgs: encodeObjects,
      fee: { amount: [], gas: "0" }, // Fee is determined at execution time
      memo: proposal.description,
      chainId: this.chainId,
      accountNumber: 0, // Not applicable for contract multisig
      sequence: 0, // Not applicable for contract multisig
    };

    return {
      id: proposalId.toString(),
      multisigAddress: this.multisigAddress,
      chainId: this.chainId,
      payloadHash: this.computePayloadHash(content),
      content,
      status: this.mapContractStatus(proposal.status) as ProposalState["status"],
      createdAt: new Date().toISOString(), // Would need block time from indexer
      updatedAt: new Date().toISOString(),
      signatures: [], // Not applicable - we use votes instead
      approvalWeight: yesWeight,
      threshold,
      isReady: yesWeight >= threshold || proposal.status === "passed",
    };
  }

  // ============================================================================
  // Phase 2: Snapshot Methods
  // ============================================================================

  /**
   * Capture member snapshot at proposal creation
   * 
   * This captures the full member set at the time a proposal is created,
   * enabling audit of who was eligible to vote when.
   */
  private async captureMemberSnapshot(proposalId: number): Promise<void> {
    if (!this.groupProvider) {
      return;
    }

    try {
      const snapshot = await this.groupProvider.snapshotMembers();
      
      localDb.createMemberSnapshot({
        contractAddress: this.multisigAddress,
        proposalId,
        groupAddress: this.groupAddress ?? "",
        snapshotHeight: snapshot.snapshotHeight,
        snapshotTime: snapshot.snapshotTime,
        membersJSON: JSON.stringify(snapshot.members.map((m: GroupMember) => ({
          addr: m.address,
          weight: m.weight,
        }))),
        totalWeight: snapshot.totalWeight,
      });
    } catch (error) {
      // Log but don't fail - snapshot is advisory
      console.error("Failed to capture member snapshot:", error);
    }
  }

  /**
   * Capture vote snapshot at vote time
   * 
   * This records the voter's weight at the exact moment they voted,
   * enabling accurate threshold calculations even if membership changes.
   * 
   * Phase 3: Also records credential validity at vote time for audit trail.
   */
  private async captureVoteSnapshot(
    proposalId: number,
    voterAddress: string,
    voteHeight: number,
  ): Promise<void> {
    try {
      let weightAtVote: number;
      let credentialValid = true;

      // Phase 3: Check credential validity for credential-gated multisigs
      if (this.isCredentialGated() && this.credentialVerifier) {
        const credResult = await this.credentialVerifier.verifyCredential(
          this.multisigAddress,
          voterAddress,
        );
        credentialValid = credResult.isValid;
      }

      if (this.groupProvider) {
        // For flex-style, get weight from group provider
        const member = await this.groupProvider.getMember(voterAddress);
        weightAtVote = member?.weight ?? 0;
      } else {
        // For fixed-style, get weight from contract config
        const config = await this.getConfig();
        const voter = config.voters.find((v) => v.addr === voterAddress);
        weightAtVote = voter?.weight ?? 0;
      }

      localDb.createVoteSnapshot({
        contractAddress: this.multisigAddress,
        proposalId,
        voter: voterAddress,
        weightAtVote,
        credentialValid,
        voteHeight,
        voteTime: new Date().toISOString(),
      });
    } catch (error) {
      // Log but don't fail - snapshot is advisory
      console.error("Failed to capture vote snapshot:", error);
    }
  }

  /**
   * Get the member snapshot for a proposal
   */
  async getMemberSnapshot(proposalId: number): Promise<{
    members: { addr: string; weight: number }[];
    totalWeight: number;
    snapshotHeight: number;
    snapshotTime: string;
  } | null> {
    const snapshot = localDb.getMemberSnapshot(this.multisigAddress, proposalId);
    
    if (!snapshot) {
      return null;
    }

    return {
      members: localDb.parseMemberSnapshotMembers(snapshot),
      totalWeight: snapshot.totalWeight,
      snapshotHeight: snapshot.snapshotHeight,
      snapshotTime: snapshot.snapshotTime,
    };
  }

  /**
   * Get vote snapshots for a proposal
   */
  async getVoteSnapshots(proposalId: number): Promise<Array<{
    voter: string;
    weightAtVote: number;
    credentialValid: boolean;
    voteHeight: number;
    voteTime: string;
  }>> {
    const snapshots = localDb.getVoteSnapshots(this.multisigAddress, proposalId);
    
    return snapshots.map((s) => ({
      voter: s.voter,
      weightAtVote: s.weightAtVote,
      credentialValid: s.credentialValid,
      voteHeight: s.voteHeight,
      voteTime: s.voteTime,
    }));
  }

  /**
   * Get vote weight calculation using snapshots
   * 
   * Uses vote-time weights for accurate threshold evaluation
   */
  async getVoteWeightFromSnapshots(proposalId: number): Promise<{
    yes: number;
    no: number;
    abstain: number;
    veto: number;
  }> {
    return localDb.getProposalVoteWeightFromSnapshots(this.multisigAddress, proposalId);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContractMultisigEngine instance
 */
export async function createContractMultisigEngine(
  config: ContractEngineConfig,
): Promise<ContractMultisigEngine> {
  const engine = new ContractMultisigEngine(config);
  // Validate the contract exists by fetching config
  await engine.getConfig();
  return engine;
}

/**
 * Check if an address is a CW3 multisig contract
 */
export async function isContractMultisig(
  nodeAddress: string,
  contractAddress: string,
): Promise<boolean> {
  try {
    const client = new CW3Client(nodeAddress, contractAddress, "");
    const config = await client.queryConfig();
    return config.voters !== undefined && config.threshold !== undefined;
  } catch {
    return false;
  }
}

