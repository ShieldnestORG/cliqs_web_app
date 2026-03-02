/**
 * Group Module Exports
 *
 * File: lib/group/index.ts
 *
 * Central export point for all group-related functionality.
 *
 * Phase 2: Group-Backed Multisig
 */

// Types
export * from "./types";

// Provider interface and registry
export {
  type GroupProvider,
  type GroupProviderFactory,
  type GroupProviderFactoryConfig,
  type GroupProviderRegistry,
  type ValidationResult,
  type ValidationError,
  DefaultGroupProviderRegistry,
  groupProviderRegistry,
} from "./provider";

// CW4 implementation
export { CW4GroupProvider, createCW4GroupProvider } from "./cw4-provider";
