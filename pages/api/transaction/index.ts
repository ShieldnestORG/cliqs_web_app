import { getMultisig } from "@/graphql/multisig";
import { createSignature } from "@/graphql/signature";
import { createTransaction } from "@/graphql/transaction";
import { CreateDbTxBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { ensureDbReady } from "@/lib/dbInit";
import { normalizeDbTransactionJson } from "@/lib/transactionJson";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to create transaction";

const parseImportedSignatures = (value: CreateDbTxBody["importedSignatures"]) => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Field "importedSignatures" must be an array when provided.');
  }

  return value.map((signature, index) => {
    if (!signature || typeof signature !== "object") {
      throw new Error(`importedSignatures[${index}] must be an object.`);
    }
    if (typeof signature.address !== "string" || !signature.address) {
      throw new Error(`importedSignatures[${index}].address must be a non-empty string.`);
    }
    if (typeof signature.signature !== "string" || !signature.signature) {
      throw new Error(`importedSignatures[${index}].signature must be a non-empty string.`);
    }
    if (typeof signature.bodyBytes !== "string" || !signature.bodyBytes) {
      throw new Error(`importedSignatures[${index}].bodyBytes must be a non-empty string.`);
    }

    return signature;
  });
};

async function apiCreateTransaction(req: NextApiRequest, res: NextApiResponse) {
  await ensureDbReady();
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body: CreateDbTxBody = req.body;

  try {
    const importedSignatures = parseImportedSignatures(body.importedSignatures);
    const normalizedDataJSON = normalizeDbTransactionJson(body.dataJSON, {
      expectedChainId: body.chainId,
      requireNonEmptyMsgs: true,
    });

    const multisig = await getMultisig(body.chainId, body.creator);
    if (!multisig) {
      throw new Error(`multisig not found with address ${body.creator} on chain ${body.chainId}`);
    }

    // Safely serialize dataJSON, handling BigInt values
    const serializedDataJSON = JSON.stringify(normalizedDataJSON, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );

    const txId = await createTransaction({
      dataJSON: serializedDataJSON,
      creator: { id: multisig.id },
    });

    for (const importedSignature of importedSignatures) {
      await createSignature({
        ...importedSignature,
        transaction: { id: txId },
      });
    }

    // Terse operational log only — no payloads, amounts, or memos
    console.log("Create transaction success:", txId);

    res.status(200).send({ txId });
  } catch (err: unknown) {
    console.error("apiCreateTransaction failed:", err instanceof Error ? err.message : err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiCreateTransaction);
