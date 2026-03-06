import { createMultisig } from "@/graphql/multisig";
import { CreateDbMultisigBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { syncMultisigToIndexer } from "@/lib/multisigIndexer";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to create multisig";

async function apiCreateMultisig(req: NextApiRequest, res: NextApiResponse) {
  const chainId = req.query.chainId;

  if (req.method !== "POST" || typeof chainId !== "string" || !chainId) {
    res.status(405).end();
    return;
  }

  const multisigDraft: CreateDbMultisigBody = req.body;

  try {
    if (chainId !== multisigDraft.chainId) {
      throw new Error(
        `tried to create multisig on chain ${chainId} with data for chain ${multisigDraft.chainId}`,
      );
    }

    const dbMultisigAddress = await createMultisig(multisigDraft);

    try {
      await syncMultisigToIndexer(multisigDraft, { source: "app_import" });
    } catch (error) {
      console.log(
        "[apiCreateMultisig] Failed to sync multisig to indexer:",
        error instanceof Error ? error.message : error,
      );
    }

    res.status(200).send({ dbMultisigAddress });
  } catch (err: unknown) {
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiCreateMultisig);
