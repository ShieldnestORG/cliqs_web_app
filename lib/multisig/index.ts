/**
 * MultisigEngine Module Exports
 * 
 * File: lib/multisig/index.ts
 */

// Types
export * from "./types";

// Contract types
export * from "./contract-types";

// Engine interface
export * from "./engine";

// PubKey implementation
export { PubKeyMultisigEngine, createPubKeyMultisigEngine } from "./pubkey-engine";

// Contract implementation
export {
  ContractMultisigEngine,
  createContractMultisigEngine,
  isContractMultisig,
  type ContractEngineConfig,
} from "./contract-engine";

