import { StdFee } from "@cosmjs/amino";
import { EncodeObject } from "@cosmjs/proto-signing";
import { z } from "zod";
import * as db from "@/lib/db";
import { DbMultisig, DbMultisigId, DbSignatureObj } from ".";

export const DbTransaction = z.object({
  id: z.string(),
  txHash: z.string().nullish(),
  creator: z.lazy(() => DbMultisig.nullish()),
  // When parsed with JSON.parse it's DbTransactionParsedDataJson
  dataJSON: z.string(),
  signatures: z.lazy(() => z.array(DbSignatureObj)),
  status: z.enum(["pending", "broadcast", "cancelled"]).optional(),
});
export type DbTransaction = Readonly<z.infer<typeof DbTransaction>>;

export interface DbTransactionParsedDataJson {
  readonly accountNumber: number;
  readonly sequence: number;
  readonly chainId: string;
  readonly msgs: EncodeObject[];
  readonly fee: StdFee;
  readonly memo: string;
}

export type DbTransactionDraft = Pick<DbTransaction, "dataJSON"> & { creator: DbMultisigId };

export const DbTransactionId = DbTransaction.pick({ id: true });
export type DbTransactionId = Readonly<z.infer<typeof DbTransactionId>>;

export const getTransaction = async (id: string): Promise<DbTransaction | null> => {
  const fetchedTx = await db.getTransaction(id);

  if (!fetchedTx) {
    return null;
  }

  // Get multisig creator
  const multisig = await db.getMultisigById(fetchedTx.creatorId);

  // Get signatures
  const signatures = await db.getSignaturesByTransaction(id);

  const transaction: DbTransaction = {
    id: fetchedTx.id,
    txHash: fetchedTx.txHash,
    creator: multisig || null,
    dataJSON: fetchedTx.dataJSON,
    signatures: signatures.map((s) => ({
      bodyBytes: s.bodyBytes,
      signature: s.signature,
      address: s.address,
    })),
    status: fetchedTx.status || (fetchedTx.txHash ? "broadcast" : "pending"),
  };

  DbTransaction.parse(transaction);

  return transaction;
};

const DbMultisigTxs = z.object({ transactions: z.array(DbTransaction) });
type DbMultisigTxs = Readonly<z.infer<typeof DbMultisigTxs>>;

export const getTransactions = async (creatorId: string): Promise<readonly DbTransaction[]> => {
  const fetchedTxs = await db.getTransactionsByCreator(creatorId);

  // Map transactions with full data
  const transactions: DbTransaction[] = [];
  for (const tx of fetchedTxs) {
    const multisig = await db.getMultisigById(tx.creatorId);
    const signatures = await db.getSignaturesByTransaction(tx.id);

    transactions.push({
      id: tx.id,
      txHash: tx.txHash,
      creator: multisig || null,
      dataJSON: tx.dataJSON,
      signatures: signatures.map((s) => ({
        bodyBytes: s.bodyBytes,
        signature: s.signature,
        address: s.address,
      })),
      status: tx.status || (tx.txHash ? "broadcast" : "pending"),
    });
  }

  // Reverse to show newest first
  const result: DbMultisigTxs = { transactions: transactions.reverse() };
  DbMultisigTxs.parse(result);

  return result.transactions;
};

export const createTransaction = async (transaction: DbTransactionDraft) => {
  console.log("DEBUG: graphql.createTransaction called", {
    dataJSON: transaction.dataJSON.substring(0, 100) + "...",
    creatorId: transaction.creator.id,
  });

  const createdTxId = await db.createTransaction({
    dataJSON: transaction.dataJSON,
    creatorId: transaction.creator.id,
    txHash: null,
  });

  console.log("DEBUG: graphql.createTransaction returning", createdTxId);
  return createdTxId;
};

const _DbTransactionTxHash = z.object({ txHash: z.string() });
type _DbTransactionTxHash = Readonly<z.infer<typeof _DbTransactionTxHash>>;

export const updateTxHash = async (id: string, txHash: string) => {
  await db.updateTransactionHash(id, txHash);
  return txHash;
};

export const cancelTransaction = async (id: string) => {
  await db.cancelTransaction(id);
  return id;
};

export const getPendingTransactions = async (
  creatorId: string,
): Promise<readonly DbTransaction[]> => {
  const fetchedTxs = await db.getPendingTransactionsByCreator(creatorId);

  // Map transactions with full data
  const transactions: DbTransaction[] = [];
  for (const tx of fetchedTxs) {
    const multisig = await db.getMultisigById(tx.creatorId);
    const signatures = await db.getSignaturesByTransaction(tx.id);

    transactions.push({
      id: tx.id,
      txHash: tx.txHash,
      creator: multisig || null,
      dataJSON: tx.dataJSON,
      signatures: signatures.map((s) => ({
        bodyBytes: s.bodyBytes,
        signature: s.signature,
        address: s.address,
      })),
      status: "pending",
    });
  }

  return transactions;
};
