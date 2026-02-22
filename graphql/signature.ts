import { z } from "zod";
import * as db from "@/lib/db";
import { DbTransactionId } from ".";

// Calling DbSignatureObj to avoid DbSignatureSignature for the field type
export const DbSignatureObj = z.object({
  bodyBytes: z.string(),
  signature: z.string(),
  address: z.string(),
});
export type DbSignatureObj = Readonly<z.infer<typeof DbSignatureObj>>;

export type DbSignatureObjDraft = DbSignatureObj & { readonly transaction: DbTransactionId };

const _DbSignatureObjSignature = DbSignatureObj.pick({ signature: true });
type _DbSignatureObjSignature = Readonly<z.infer<typeof _DbSignatureObjSignature>>;

export const createSignature = async (signature: DbSignatureObjDraft) => {
  await db.createSignature({
    transactionId: signature.transaction.id,
    bodyBytes: signature.bodyBytes,
    signature: signature.signature,
    address: signature.address,
  });

  return signature.signature;
};
