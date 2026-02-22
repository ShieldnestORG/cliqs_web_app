import { z } from "zod";
import * as db from "@/lib/db";

const DbNonceObjNonce = z.object({ nonce: z.number() });
type DbNonceObjNonce = Readonly<z.infer<typeof DbNonceObjNonce>>;

export const getNonce = async (chainId: string, address: string) => {
  const dbNonceObj = await db.getNonce(chainId, address);

  if (dbNonceObj) {
    DbNonceObjNonce.parse({ nonce: dbNonceObj.nonce });
    return dbNonceObj.nonce;
  }

  // Create with initial nonce of 1
  await db.createOrUpdateNonce(chainId, address, 1);
  return 1;
};

export const incrementNonce = async (chainId: string, address: string) => {
  const dbNonce = await getNonce(chainId, address);
  const newNonce = dbNonce + 1;

  await db.createOrUpdateNonce(chainId, address, newNonce);

  return newNonce;
};
