import { faultController } from "./faults";
import { installChaosPatches } from "./installPatches";

import { ContractMultisigEngine } from "../../lib/multisig/contract-engine";
import { PubKeyMultisigEngine } from "../../lib/multisig/pubkey-engine";
import { CW3Client } from "../../lib/contract/cw3-client";

import type { ContractEngineConfig } from "../../lib/multisig/contract-engine";
import type { EngineConfig } from "../../lib/multisig/engine";
import type { MultisigThresholdPubkey } from "@cosmjs/amino";

installChaosPatches();

export class MultisigChaosHarness {
  contractEngine?: ContractMultisigEngine;
  pubkeyEngine?: PubKeyMultisigEngine;
  cw3?: CW3Client;

  constructor(readonly mode: "contract" | "pubkey" | "cw3") {}

  /* ---------------------------------- */
  /* Construction                       */
  /* ---------------------------------- */

  createContractEngine(config: ContractEngineConfig) {
    this.contractEngine = new ContractMultisigEngine({
      ...config,
      policyEvaluator: config.policyEvaluator,
      policyVersion: config.policyVersion ?? 1,
    });
    return this.contractEngine;
  }

  createPubkeyEngine(config: EngineConfig, pubkey: MultisigThresholdPubkey) {
    this.pubkeyEngine = new PubKeyMultisigEngine(config, pubkey);
    return this.pubkeyEngine;
  }

  createCW3(node: string, contract: string, chainId: string) {
    this.cw3 = new CW3Client(node, contract, chainId);
    return this.cw3;
  }

  /* ---------------------------------- */
  /* Proposal Lifecycle Hooks           */
  /* ---------------------------------- */

  async submitProposal(create: () => Promise<string>) {
    return create();
  }

  async vote(voteFn: () => Promise<void>) {
    await faultController.fire("beforeVote");
    await voteFn();
    await faultController.fire("afterVote");
  }

  async executeProposal(proposalId: string | number, opts?: { executor?: string }) {
    await faultController.fire("beforeExecute");

    let result: any;

    if (this.mode === "contract") {
      if (!this.contractEngine) throw new Error("Contract engine not initialized");
      result = await this.contractEngine.executeProposal(String(proposalId), opts?.executor);
    }

    if (this.mode === "pubkey") {
      if (!this.pubkeyEngine) throw new Error("Pubkey engine not initialized");
      result = await this.pubkeyEngine.executeProposal(String(proposalId));
    }

    if (this.mode === "cw3") {
      if (!this.cw3) throw new Error("CW3 client not initialized");
      result = await this.cw3.execute(Number(proposalId));
    }

    return result;
  }
}
