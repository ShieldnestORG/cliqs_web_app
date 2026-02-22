/**
 * PubKeyMultisigEngine Implementation
 * 
 * File: lib/multisig/pubkey-engine.ts
 * 
 * This implementation wraps the existing Cosmos SDK pubkey-derived multisig logic.
 * It provides a unified interface for creating proposals, collecting signatures,
 * and broadcasting transactions.
 */

import { MultisigThresholdPubkey, pubkeyToAddress } from "@cosmjs/amino";
import { wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { sha256 } from "@cosmjs/crypto";
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import { Registry, TxBodyEncodeObject, EncodeObject } from "@cosmjs/proto-signing";
import { defaultRegistryTypes, StargateClient } from "@cosmjs/stargate";

import {
  MultisigEngine,
  SignBytesResult,
  ActionSummary,
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
  SignatureShare,
  SignerInfo,
  SignMode,
  TxResult,
  MultisigEngineError,
} from "./types";
import {
  makeDirectModeAuthInfo,
  makeDirectSignDoc,
  makeMultisignedTxBytesDirect,
} from "../multisigDirect";
import { makeMultisignedTxBytes } from "@cosmjs/stargate";

// ============================================================================
// PubKeyMultisigEngine
// ============================================================================

export class PubKeyMultisigEngine implements MultisigEngine {
  readonly engineType = "pubkey" as const;
  readonly chainId: string;
  readonly multisigAddress: string;

  private readonly multisigPubkey: MultisigThresholdPubkey;
  private readonly nodeAddress: string;
  private readonly nodeAddresses: readonly string[];
  private readonly registry: Registry;

  // In-memory proposal storage (will be replaced by DB calls)
  private proposals: Map<string, ProposalState> = new Map();

  constructor(
    config: EngineConfig,
    multisigPubkey: MultisigThresholdPubkey,
  ) {
    this.chainId = config.chainId;
    this.multisigAddress = config.multisigAddress;
    this.nodeAddress = config.nodeAddress;
    this.nodeAddresses = config.nodeAddresses ?? [config.nodeAddress];
    this.multisigPubkey = multisigPubkey;
    this.registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  }

  // ============================================================================
  // Proposal Lifecycle
  // ============================================================================

  async createProposal(input: ProposalInput): Promise<Proposal> {
    const proposalId = this.generateProposalId();
    const now = new Date().toISOString();

    const content: ProposalContent = {
      msgs: input.msgs,
      fee: input.fee,
      memo: input.memo ?? "",
      chainId: this.chainId,
      accountNumber: input.accountNumber,
      sequence: input.sequence,
    };

    // Compute canonical payload hash
    const payloadHash = this.computePayloadHash(content);

    const proposal: Proposal = {
      id: proposalId,
      multisigAddress: this.multisigAddress,
      chainId: this.chainId,
      payloadHash,
      content,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const proposalState: ProposalState = {
      ...proposal,
      signatures: [],
      approvalWeight: 0,
      threshold: Number(this.multisigPubkey.value.threshold),
      isReady: false,
    };

    this.proposals.set(proposalId, proposalState);

    return proposal;
  }

  async approveProposal(
    proposalId: string,
    signer: SignerInfo,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<ApprovalReceipt> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    if (proposal.status !== "pending" && proposal.status !== "signing") {
      throw new MultisigEngineError(
        `Proposal ${proposalId} is not pending`,
        "PROPOSAL_NOT_PENDING",
      );
    }

    // Check if signer is a member
    const members = await this.listMembers();
    const member = members.find((m) => m.address === signer.address);
    if (!member) {
      throw new MultisigEngineError(
        `${signer.address} is not a member of this multisig`,
        "SIGNER_NOT_MEMBER",
      );
    }

    // Check if already signed
    if (proposal.signatures.some((s) => s.signerAddress === signer.address)) {
      throw new MultisigEngineError(
        `${signer.address} has already signed this proposal`,
        "ALREADY_SIGNED",
      );
    }

    // Get body bytes for storage
    const { bodyBytes } = this.getBodyBytes(proposal.content);

    const signatureShare: SignatureShare = {
      proposalId,
      signerAddress: signer.address,
      signMode: this.detectSignMode(proposal.content.msgs),
      signatureBytes,
      signDocHash,
      bodyBytes: toBase64(bodyBytes),
      createdAt: new Date().toISOString(),
    };

    const newSignatures = [...proposal.signatures, signatureShare];
    const newApprovalWeight = newSignatures.length; // Weight 1 per signer for pubkey multisig
    const isReady = newApprovalWeight >= proposal.threshold;

    const updatedProposal: ProposalState = {
      ...proposal,
      status: isReady ? "ready" : "signing",
      signatures: newSignatures,
      approvalWeight: newApprovalWeight,
      isReady,
      updatedAt: new Date().toISOString(),
    };

    this.proposals.set(proposalId, updatedProposal);

    return {
      proposalId,
      signerAddress: signer.address,
      signDocHash,
      signatureBytes,
      timestamp: signatureShare.createdAt,
      newApprovalWeight,
      isReady,
    };
  }

  async revokeApproval(
    proposalId: string,
    signer: SignerInfo,
  ): Promise<RevokeReceipt> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    const sigIndex = proposal.signatures.findIndex(
      (s) => s.signerAddress === signer.address,
    );
    if (sigIndex === -1) {
      throw new MultisigEngineError(
        `No signature found for ${signer.address}`,
        "SIGNATURE_NOT_FOUND",
      );
    }

    const newSignatures = [
      ...proposal.signatures.slice(0, sigIndex),
      ...proposal.signatures.slice(sigIndex + 1),
    ];
    const newApprovalWeight = newSignatures.length;

    const updatedProposal: ProposalState = {
      ...proposal,
      status: newSignatures.length > 0 ? "signing" : "pending",
      signatures: newSignatures,
      approvalWeight: newApprovalWeight,
      isReady: false,
      updatedAt: new Date().toISOString(),
    };

    this.proposals.set(proposalId, updatedProposal);

    return {
      proposalId,
      signerAddress: signer.address,
      timestamp: new Date().toISOString(),
      newApprovalWeight,
    };
  }

  async executeProposal(proposalId: string): Promise<TxResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    if (!proposal.isReady) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} has not met threshold (${proposal.approvalWeight}/${proposal.threshold})`,
        "THRESHOLD_NOT_MET",
      );
    }

    // Assemble the multisig transaction
    const txBytes = this.assembleMultisigTx(proposal);

    // Broadcast
    const client = await StargateClient.connect(this.nodeAddress);
    const result = await client.broadcastTx(txBytes);

    const txResult: TxResult = {
      proposalId,
      txHash: result.transactionHash,
      height: result.height,
      gasUsed: Number(result.gasUsed),
      gasWanted: Number(result.gasWanted),
      success: result.code === 0,
      rawLog: result.rawLog,
      timestamp: new Date().toISOString(),
    };

    // Update proposal status
    const updatedProposal: ProposalState = {
      ...proposal,
      status: result.code === 0 ? "confirmed" : "failed",
      updatedAt: new Date().toISOString(),
    };
    this.proposals.set(proposalId, updatedProposal);

    return txResult;
  }

  async cancelProposal(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }

    const updatedProposal: ProposalState = {
      ...proposal,
      status: "cancelled",
      updatedAt: new Date().toISOString(),
    };
    this.proposals.set(proposalId, updatedProposal);
  }

  // ============================================================================
  // Queries
  // ============================================================================

  async getProposal(proposalId: string): Promise<ProposalState> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new MultisigEngineError(
        `Proposal ${proposalId} not found`,
        "PROPOSAL_NOT_FOUND",
      );
    }
    return proposal;
  }

  async listProposals(status?: string): Promise<readonly ProposalState[]> {
    const all = Array.from(this.proposals.values());
    if (status) {
      return all.filter((p) => p.status === status);
    }
    return all;
  }

  async getPolicy(): Promise<MultisigPolicy> {
    const members = await this.listMembers();
    return {
      threshold: Number(this.multisigPubkey.value.threshold),
      totalWeight: members.reduce((sum, m) => sum + m.weight, 0),
      signModes: ["amino", "direct"],
      version: 1,
    };
  }

  async listMembers(): Promise<readonly Member[]> {
    const prefix = this.multisigAddress.split("1")[0];
    return this.multisigPubkey.value.pubkeys.map((pk) => ({
      address: pubkeyToAddress(pk, prefix),
      pubkey: pk.value,
      weight: 1, // Equal weight for pubkey multisig
    }));
  }

  // ============================================================================
  // Signing Helpers
  // ============================================================================

  async getSignBytes(
    proposalId: string,
    signMode: SignMode,
  ): Promise<SignBytesResult> {
    const proposal = await this.getProposal(proposalId);
    const { content } = proposal;

    const { bodyBytes } = this.getBodyBytes(content);

    if (signMode === "direct") {
      const { authInfoBytes } = makeDirectModeAuthInfo(
        this.multisigPubkey,
        content.sequence,
        content.fee,
      );

      const { signDocBytes, signDocHash } = makeDirectSignDoc(
        bodyBytes,
        authInfoBytes,
        content.chainId,
        content.accountNumber,
      );

      return {
        signBytes: signDocBytes,
        signDocHash: toBase64(signDocHash),
        bodyBytes,
        signMode,
        summary: this.createTransactionSummary(content),
      };
    }

    // Amino mode - return the body bytes for now
    // Full Amino SignDoc construction would require AminoTypes
    return {
      signBytes: bodyBytes,
      signDocHash: toBase64(sha256(bodyBytes)),
      bodyBytes,
      signMode,
      summary: this.createTransactionSummary(content),
    };
  }

  async verifySignature(
    proposalId: string,
    signerAddress: string,
    signatureBytes: string,
    signDocHash: string,
  ): Promise<boolean> {
    const proposal = await this.getProposal(proposalId);
    const signature = proposal.signatures.find(
      (s) => s.signerAddress === signerAddress,
    );

    if (!signature) {
      return false;
    }

    return (
      signature.signatureBytes === signatureBytes &&
      signature.signDocHash === signDocHash
    );
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private generateProposalId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private computePayloadHash(content: ProposalContent): string {
    // Create deterministic JSON representation
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

  private getBodyBytes(content: ProposalContent): { bodyBytes: Uint8Array } {
    const txBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: content.msgs as EncodeObject[],
        memo: content.memo,
      },
    };
    const bodyBytes = this.registry.encode(txBodyEncodeObject);
    return { bodyBytes };
  }

  private detectSignMode(msgs: readonly EncodeObject[]): SignMode {
    // MsgWithdrawValidatorCommission requires Direct mode on TX
    const directModeRequiredTypes = [
      "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission",
    ];

    const requiresDirect = msgs.some((m) =>
      directModeRequiredTypes.includes(m.typeUrl),
    );

    return requiresDirect ? "direct" : "amino";
  }

  private assembleMultisigTx(proposal: ProposalState): Uint8Array {
    const signMode = this.detectSignMode(proposal.content.msgs);

    if (signMode === "direct") {
      return this.assembleDirectModeTx(proposal);
    }

    return this.assembleAminoModeTx(proposal);
  }

  private assembleDirectModeTx(proposal: ProposalState): Uint8Array {
    const { bodyBytes } = this.getBodyBytes(proposal.content);
    const signatures = new Map<string, Uint8Array>();

    for (const sig of proposal.signatures) {
      signatures.set(sig.signerAddress, fromBase64(sig.signatureBytes));
    }

    return makeMultisignedTxBytesDirect(
      this.multisigPubkey,
      proposal.content.sequence,
      proposal.content.fee,
      bodyBytes,
      signatures,
    );
  }

  private assembleAminoModeTx(proposal: ProposalState): Uint8Array {
    const { bodyBytes } = this.getBodyBytes(proposal.content);
    const signatures = new Map<string, Uint8Array>();

    for (const sig of proposal.signatures) {
      signatures.set(sig.signerAddress, fromBase64(sig.signatureBytes));
    }

    return makeMultisignedTxBytes(
      this.multisigPubkey,
      proposal.content.sequence,
      proposal.content.fee,
      bodyBytes,
      signatures,
    );
  }

  private createTransactionSummary(content: ProposalContent): {
    actions: readonly ActionSummary[];
    fee: string;
    memo?: string;
  } {
    const actions: ActionSummary[] = content.msgs.map((msg) => {
      const typeUrl = msg.typeUrl;
      const typeName = typeUrl.split(".").pop() || typeUrl;

      return {
        type: typeName.replace("Msg", ""),
        description: this.getMessageDescription(msg),
        details: this.getMessageDetails(msg),
      };
    });

    const feeAmount = content.fee.amount
      .map((c) => `${c.amount} ${c.denom}`)
      .join(", ");

    return {
      actions,
      fee: `${feeAmount} (gas: ${content.fee.gas})`,
      memo: content.memo || undefined,
    };
  }

  private getMessageDescription(msg: EncodeObject): string {
    const { typeUrl, value } = msg;

    switch (typeUrl) {
      case "/cosmos.bank.v1beta1.MsgSend":
        return `Send tokens to ${value.toAddress}`;
      case "/cosmos.staking.v1beta1.MsgDelegate":
        return `Delegate to validator ${value.validatorAddress}`;
      case "/cosmos.staking.v1beta1.MsgUndelegate":
        return `Undelegate from validator ${value.validatorAddress}`;
      case "/cosmos.gov.v1beta1.MsgVote":
        return `Vote on proposal #${value.proposalId}`;
      case "/cosmwasm.wasm.v1.MsgExecuteContract":
        return `Execute contract ${value.contract}`;
      default:
        return `Execute ${typeUrl.split(".").pop()}`;
    }
  }

  private getMessageDetails(msg: EncodeObject): Record<string, string> {
    const { typeUrl, value } = msg;
    const details: Record<string, string> = {};

    switch (typeUrl) {
      case "/cosmos.bank.v1beta1.MsgSend":
        details["from"] = value.fromAddress;
        details["to"] = value.toAddress;
        if (value.amount?.length) {
          details["amount"] = value.amount
            .map((c: { amount: string; denom: string }) => `${c.amount} ${c.denom}`)
            .join(", ");
        }
        break;
      case "/cosmos.staking.v1beta1.MsgDelegate":
        details["delegator"] = value.delegatorAddress;
        details["validator"] = value.validatorAddress;
        if (value.amount) {
          details["amount"] = `${value.amount.amount} ${value.amount.denom}`;
        }
        break;
      default:
        // Generic: include all top-level string values
        for (const [key, val] of Object.entries(value)) {
          if (typeof val === "string") {
            details[key] = val;
          }
        }
    }

    return details;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PubKeyMultisigEngine instance
 */
export async function createPubKeyMultisigEngine(
  config: EngineConfig,
  multisigPubkey: MultisigThresholdPubkey,
): Promise<PubKeyMultisigEngine> {
  return new PubKeyMultisigEngine(config, multisigPubkey);
}

