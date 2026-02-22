/**
 * Contract Upload Hook
 *
 * File: lib/hooks/useContractUpload.ts
 *
 * Encapsulates the two-step deployment flow:
 *   1. Upload WASM bytecode → get Code ID
 *   2. Instantiate contract instance → get contract address
 *
 * Supports both bundled (default) and user-provided WASM binaries.
 */

import { useState, useCallback } from "react";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { OfflineSigner } from "@cosmjs/proto-signing";
import { loadBundledWasm, formatWasmSize, type BundledContractType } from "@/lib/contract/bundledWasm";
import { appendDeploymentLog } from "@/lib/deploymentLog";
import { getGasAdjustment, saveUserCodeIds } from "@/lib/contract/codeRegistry";
import { ensureProtocol } from "@/lib/utils";

export type UploadSource = "bundled" | "custom";

export type UploadStatus =
  | "idle"
  | "loading-wasm"
  | "uploading"
  | "uploaded"
  | "error";

export interface UploadResult {
  codeId: number;
  txHash: string;
  wasmSize: number;
  source: UploadSource;
}

interface UseContractUploadOptions {
  chainId: string;
  nodeAddress: string;
  gasPrice: string;
}

export function useContractUpload({ chainId, nodeAddress, gasPrice }: UseContractUploadOptions) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  const uploadWasm = useCallback(
    async (
      signer: OfflineSigner,
      senderAddress: string,
      contractType: BundledContractType,
      source: UploadSource = "bundled",
      customWasmBytes?: Uint8Array,
    ): Promise<UploadResult | null> => {
      try {
        setStatus("loading-wasm");
        setError(null);

        let wasmBytes: Uint8Array;
        if (source === "custom" && customWasmBytes) {
          wasmBytes = customWasmBytes;
        } else {
          wasmBytes = await loadBundledWasm(contractType);
        }

        setStatus("uploading");

        const client = await SigningCosmWasmClient.connectWithSigner(
          ensureProtocol(nodeAddress),
          signer,
          { gasPrice: GasPrice.fromString(gasPrice) },
        );

        const gasAdj = getGasAdjustment(chainId);
        const uploadResult = await client.upload(
          senderAddress,
          wasmBytes,
          gasAdj,
          `CLIQ ${contractType} upload`,
        );

        const uploadData: UploadResult = {
          codeId: uploadResult.codeId,
          txHash: uploadResult.transactionHash,
          wasmSize: wasmBytes.length,
          source,
        };

        appendDeploymentLog({
          stage: "upload",
          network: chainId.toLowerCase().includes("testnet") ? "testnet" : "mainnet",
          chainId,
          wallet: senderAddress,
          contractType,
          label: `CLIQ auto-upload (${source})`,
          codeId: uploadResult.codeId,
          txHash: uploadResult.transactionHash,
        });

        saveUserCodeIds(chainId, {
          ...(contractType === "cw3-fixed" ? { cw3Fixed: uploadResult.codeId } : {}),
          ...(contractType === "cw3-flex" ? { cw3Flex: uploadResult.codeId } : {}),
          ...(contractType === "cw4-group" ? { cw4Group: uploadResult.codeId } : {}),
          source: `User upload (${new Date().toISOString().slice(0, 10)})`,
        });

        setResult(uploadData);
        setStatus("uploaded");
        return uploadData;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown upload error";
        setError(message);
        setStatus("error");
        return null;
      }
    },
    [chainId, nodeAddress, gasPrice],
  );

  return {
    status,
    result,
    error,
    uploadWasm,
    reset,
    formatWasmSize,
  };
}
