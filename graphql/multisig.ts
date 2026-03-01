import { z } from "zod";
import * as db from "@/lib/db";

/**
 * Database schema for a Cliq (multisig)
 *
 * A Cliq is a multisig group that lets multiple people manage shared funds.
 * Uses MongoDB Atlas when available, falls back to local JSON database.
 */
export const DbMultisig = z.object({
  id: z.string(),
  chainId: z.string(),
  address: z.string(),
  creator: z.string().nullish(),
  pubkeyJSON: z.string(),
  // Cliq-specific fields
  name: z.string().nullish(),
  description: z.string().nullish(),
  version: z.number().optional().default(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type DbMultisig = Readonly<z.infer<typeof DbMultisig>>;

export type DbMultisigDraft = {
  readonly chainId: string;
  readonly address: string;
  readonly creator: string;
  readonly pubkeyJSON: string;
  readonly name?: string | null | undefined;
  readonly description?: string | null | undefined;
};

export const DbMultisigId = DbMultisig.pick({ id: true });
export type DbMultisigId = Readonly<z.infer<typeof DbMultisigId>>;

export const getMultisig = async (
  chainId: string,
  multisigAddress: string,
): Promise<DbMultisig | null> => {
  const fetchedMultisig = await db.getMultisig(chainId, multisigAddress);

  if (!fetchedMultisig) {
    return null;
  }

  DbMultisig.parse(fetchedMultisig);

  return fetchedMultisig;
};

export const getCreatedMultisigs = async (
  chainId: string,
  creatorAddress: string,
): Promise<readonly DbMultisig[]> => {
  const fetchedMultisigs = await db.getCreatedMultisigs(chainId, creatorAddress);
  DbMultisigs.parse(fetchedMultisigs);

  return fetchedMultisigs;
};

export const getBelongedMultisigs = async (
  chainId: string,
  memberPubkey: string,
): Promise<readonly DbMultisig[]> => {
  const fetchedMultisigs = await db.getBelongedMultisigs(chainId, memberPubkey);
  DbMultisigs.parse(fetchedMultisigs);

  return fetchedMultisigs;
};

const DbMultisigs = z.array(DbMultisig);

export const createMultisig = async (multisig: DbMultisigDraft) => {
  const address = await db.createMultisig(multisig);
  return address;
};
