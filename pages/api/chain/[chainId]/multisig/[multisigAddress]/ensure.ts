import { ChainInfo } from "@/context/ChainsContext/types";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { ensureDbReady } from "@/lib/dbInit";
import { ensureMultisigRegistered } from "@/lib/multisigRegistry";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to resolve multisig";

type EnsureDbMultisigBody = {
  readonly chain: ChainInfo;
};

async function apiEnsureMultisig(req: NextApiRequest, res: NextApiResponse) {
  await ensureDbReady();

  const chainId = req.query.chainId;
  const multisigAddress = req.query.multisigAddress;

  if (
    req.method !== "POST" ||
    typeof chainId !== "string" ||
    !chainId ||
    typeof multisigAddress !== "string" ||
    !multisigAddress
  ) {
    res.status(405).end();
    return;
  }

  const body: EnsureDbMultisigBody = req.body;

  try {
    if (chainId !== body.chain.chainId) {
      throw new Error(
        `tried resolving multisig on chain ${chainId} with data for chain ${body.chain.chainId}`,
      );
    }

    const result = await ensureMultisigRegistered(multisigAddress, body.chain);
    res.status(200).send(result);
  } catch (err: unknown) {
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiEnsureMultisig);
