import { ChainInfo } from "@/context/ChainsContext/types";
import {
  DbMultisig,
  DbMultisigDraft,
  DbSignatureObjDraft,
  DbTransaction,
  DbTransactionParsedDataJson,
} from "@/graphql";
import { StdSignature } from "@cosmjs/amino";
import { requestJson } from "./request";

export const getDbMultisig = async (multisigAddress: string, chainId: string) => {
  const multisig: DbMultisig = await requestJson(
    `/api/chain/${chainId}/multisig/${multisigAddress}`,
  );

  return multisig;
};

export type GetDbUserMultisigsBody = {
  readonly signature?: StdSignature;
  readonly address?: string;
  readonly pubkey?: string;
  readonly chain: ChainInfo;
};
export type FetchedMultisigs = {
  readonly created: readonly DbMultisig[];
  readonly belonged: readonly DbMultisig[];
};
export const getDbUserMultisigs = async (
  chain: ChainInfo,
  options?: { signature?: StdSignature; address?: string; pubkey?: string },
) => {
  const body: GetDbUserMultisigsBody = {
    ...(options?.signature && { signature: options.signature }),
    ...(options?.address && { address: options.address }),
    ...(options?.pubkey && { pubkey: options.pubkey }),
    chain,
  };

  const multisigs: FetchedMultisigs = await requestJson(
    `/api/chain/${chain.chainId}/multisig/list`,
    { body },
  );

  return multisigs;
};

export type CreateDbMultisigBody = DbMultisigDraft;
export const createDbMultisig = async (multisig: DbMultisigDraft, chainId: string) => {
  const body: CreateDbMultisigBody = multisig;

  const { dbMultisigAddress }: { dbMultisigAddress: string } = await requestJson(
    `/api/chain/${chainId}/multisig`,
    { body },
  );

  return dbMultisigAddress;
};

export type GetDbMultisigTxsBody = {
  readonly signature: StdSignature;
  readonly chain: ChainInfo;
  readonly multisigAddress: string;
};
export const getDbMultisigTxs = async (
  multisigAddress: string,
  chain: ChainInfo,
  signature: StdSignature,
) => {
  const body: GetDbMultisigTxsBody = { signature, chain, multisigAddress };
  const txs: readonly DbTransaction[] = await requestJson(`/api/transaction/list`, { body });

  return txs;
};

export type CreateDbTxBody = {
  readonly dataJSON: DbTransactionParsedDataJson;
  readonly creator: string;
  readonly chainId: string;
};
export const createDbTx = async (
  creatorAddress: string,
  chainId: string,
  dataJSON: DbTransactionParsedDataJson,
) => {
  const body: CreateDbTxBody = { dataJSON, creator: creatorAddress, chainId };
  const { txId }: { txId: string } = await requestJson("/api/transaction", { body });

  return txId;
};

export type UpdateDbTxHashBody = {
  readonly txHash: string;
};
export const updateDbTxHash = async (txId: string, txHash: string) => {
  const body: UpdateDbTxHashBody = { txHash };

  const { dbTxHash }: { dbTxHash: string } = await requestJson(`/api/transaction/${txId}`, {
    body,
  });

  return dbTxHash;
};

export type CancelDbTxBody = {
  readonly action: "cancel";
};
export const cancelDbTx = async (txId: string) => {
  const body: CancelDbTxBody = { action: "cancel" };

  const { cancelled }: { cancelled: boolean; txId: string } = await requestJson(
    `/api/transaction/${txId}`,
    { body },
  );

  return cancelled;
};

export type GetPendingTxsBody = {
  readonly multisigAddress: string;
  readonly chainId: string;
};
export const getPendingDbTxs = async (multisigAddress: string, chainId: string) => {
  const body: GetPendingTxsBody = { multisigAddress, chainId };
  const txs: readonly DbTransaction[] = await requestJson(`/api/transaction/pending`, { body });

  return txs;
};

export type CreateDbSignatureBody = Omit<DbSignatureObjDraft, "transaction">;
export const createDbSignature = async (
  txId: string,
  signatureObj: Omit<DbSignatureObjDraft, "transaction">,
) => {
  const body: CreateDbSignatureBody = signatureObj;

  const { signature }: { signature: string } = await requestJson(
    `/api/transaction/${txId}/signature`,
    { body },
  );

  return signature;
};

export const getDbNonce = async (address: string, chainId: string) => {
  const { nonce }: { nonce: number } = await requestJson(`/api/chain/${chainId}/nonce/${address}`);
  return nonce;
};

// ============================================================================
// Transaction Privacy / Wipe Operations
// ============================================================================

export type WipeMode = "completed" | "all";

export type WipeResult = {
  readonly success: boolean;
  readonly mode: WipeMode;
  readonly deletedTransactions: number;
  readonly deletedSignatures: number;
  /** Shown when using local JSON DB; wipe not supported, user must delete data file manually */
  readonly localDbNotice?: string;
};

export const wipeTransactions = async (
  multisigAddress: string,
  chainId: string,
  mode: WipeMode,
): Promise<WipeResult> => {
  const body = { multisigAddress, chainId, mode };
  const result: WipeResult = await requestJson("/api/transaction/wipe", { body });
  return result;
};

export type ExportResult = {
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly exportedAt: string;
  readonly transactionCount: number;
  readonly transactions: readonly object[];
};

export const exportTransactions = async (
  multisigAddress: string,
  chainId: string,
): Promise<ExportResult> => {
  const body = { multisigAddress, chainId };
  const result: ExportResult = await requestJson("/api/transaction/export", { body });
  return result;
};

export type DbStorageStats = {
  readonly backend: string;
  readonly multisigCount?: number;
  readonly transactionCount?: number;
  readonly signatureCount?: number;
  readonly estimatedSizeMB?: number;
  readonly limitMB?: number;
  readonly usagePercent?: string;
  readonly healthy?: boolean;
  readonly message?: string;
};

export const getDbStats = async (): Promise<DbStorageStats> => {
  const response = await fetch("/api/db/stats");
  if (!response.ok) throw new Error("Failed to fetch DB stats");
  return response.json();
};
