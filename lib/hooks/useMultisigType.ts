/**
 * Hook for detecting multisig type
 *
 * File: lib/hooks/useMultisigType.ts
 *
 * Determines whether an address is a PubKey multisig or Contract multisig
 * by querying the chain.
 */

import { useState, useEffect } from "react";
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { StargateClient } from "@cosmjs/stargate";
import { isMultisigThresholdPubkey } from "@cosmjs/amino";

// ============================================================================
// Types
// ============================================================================

export type MultisigType = "pubkey" | "contract" | "unknown" | "loading";

export interface MultisigTypeResult {
  type: MultisigType;
  isLoading: boolean;
  error: string | null;
  // For contract multisig
  contractInfo?: {
    codeId: number;
    creator: string;
    admin?: string;
    label: string;
  };
  // For pubkey multisig
  pubkeyInfo?: {
    threshold: number;
    memberCount: number;
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useMultisigType(
  address: string | null,
  nodeAddress: string | null,
  chainId: string | null,
): MultisigTypeResult {
  const [result, setResult] = useState<MultisigTypeResult>({
    type: "loading",
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function detectType() {
      if (!address || !nodeAddress || !chainId) {
        setResult({ type: "unknown", isLoading: false, error: null });
        return;
      }

      setResult({ type: "loading", isLoading: true, error: null });

      try {
        // First, try to query as a contract
        try {
          const cosmWasmClient = await CosmWasmClient.connect(nodeAddress);
          const contractInfo = await cosmWasmClient.getContract(address);

          if (contractInfo && contractInfo.codeId) {
            // It's a contract! Now check if it's a CW3 multisig
            try {
              // Try to query the threshold (CW3-specific query)
              await cosmWasmClient.queryContractSmart(address, { threshold: {} });

              if (!cancelled) {
                setResult({
                  type: "contract",
                  isLoading: false,
                  error: null,
                  contractInfo: {
                    codeId: contractInfo.codeId,
                    creator: contractInfo.creator,
                    admin: contractInfo.admin || undefined,
                    label: contractInfo.label,
                  },
                });
              }
              return;
            } catch {
              // Contract exists but not a CW3 multisig
              // Could be some other contract type
            }
          }
        } catch {
          // Not a contract, try pubkey multisig
        }

        // Try to detect as pubkey multisig
        const stargateClient = await StargateClient.connect(nodeAddress);
        const account = await stargateClient.getAccount(address);

        if (account?.pubkey && isMultisigThresholdPubkey(account.pubkey)) {
          if (!cancelled) {
            setResult({
              type: "pubkey",
              isLoading: false,
              error: null,
              pubkeyInfo: {
                threshold: Number(account.pubkey.value.threshold),
                memberCount: account.pubkey.value.pubkeys.length,
              },
            });
          }
          return;
        }

        // Could not determine type
        if (!cancelled) {
          setResult({
            type: "unknown",
            isLoading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setResult({
            type: "unknown",
            isLoading: false,
            error: err instanceof Error ? err.message : "Failed to detect multisig type",
          });
        }
      }
    }

    detectType();

    return () => {
      cancelled = true;
    };
  }, [address, nodeAddress, chainId]);

  return result;
}

// ============================================================================
// Standalone Detection Function
// ============================================================================

/**
 * Detect if an address is a contract multisig (non-hook version)
 */
interface ContractInfoResult {
  codeId: number;
  creator: string;
  admin?: string;
  label: string;
}

interface PubkeyInfoResult {
  threshold: number;
  memberCount: number;
}

export async function detectMultisigType(
  address: string,
  nodeAddress: string,
): Promise<{
  type: MultisigType;
  contractInfo?: ContractInfoResult;
  pubkeyInfo?: PubkeyInfoResult;
}> {
  // Try contract first
  try {
    const cosmWasmClient = await CosmWasmClient.connect(nodeAddress);
    const contractInfo = await cosmWasmClient.getContract(address);

    if (contractInfo && contractInfo.codeId) {
      // Try CW3 query
      try {
        await cosmWasmClient.queryContractSmart(address, { threshold: {} });
        return {
          type: "contract",
          contractInfo: {
            codeId: contractInfo.codeId,
            creator: contractInfo.creator,
            admin: contractInfo.admin,
            label: contractInfo.label,
          },
        };
      } catch {
        // Not a CW3 contract
      }
    }
  } catch {
    // Not a contract
  }

  // Try pubkey multisig
  try {
    const stargateClient = await StargateClient.connect(nodeAddress);
    const account = await stargateClient.getAccount(address);

    if (account?.pubkey && isMultisigThresholdPubkey(account.pubkey)) {
      return {
        type: "pubkey",
        pubkeyInfo: {
          threshold: Number(account.pubkey.value.threshold),
          memberCount: account.pubkey.value.pubkeys.length,
        },
      };
    }
  } catch {
    // Not a pubkey multisig
  }

  return { type: "unknown" };
}
