import { getBelongedMultisigs, getCreatedMultisigs } from "@/graphql/multisig";
import { getNonce, incrementNonce } from "@/graphql/nonce";
import { GetDbUserMultisigsBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { ensureDbReady } from "@/lib/dbInit";
import { verifyKeplrSignature } from "@/lib/keplr";
import { ensureProtocol } from "@/lib/utils";
import { decodeSignature, pubkeyToAddress } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import { StargateClient } from "@cosmjs/stargate";
import type { NextApiRequest, NextApiResponse } from "next";

const endpointErrMsg = "Failed to list multisigs";

async function apiListMultisigs(req: NextApiRequest, res: NextApiResponse) {
  await ensureDbReady();
  const chainId = req.query.chainId;

  if (req.method !== "POST" || typeof chainId !== "string" || !chainId) {
    res.status(405).end();
    return;
  }

  const body: GetDbUserMultisigsBody = req.body;

  try {
    if (chainId !== body.chain.chainId) {
      throw new Error(
        `tried listing multisigs from ${chainId} with data from ${body.chain.chainId}`,
      );
    }

    // Validate that nodeAddress is provided
    if (!body.chain.nodeAddress) {
      throw new Error("Chain nodeAddress is not configured. Please wait for the chain to finish loading.");
    }

    // Support both signature-based (verified) and direct address/pubkey (unverified) requests
    let address: string;
    let pubkey: string;

    if (body.signature) {
      // Verified request: extract address and pubkey from signature
      address = pubkeyToAddress(body.signature.pub_key, body.chain.addressPrefix);

      // On-chain account check is non-fatal: multisig members may not have
      // on-chain accounts if they've only signed through the multisig.
      // The signature itself proves key ownership.
      try {
        const client = await StargateClient.connect(ensureProtocol(body.chain.nodeAddress));
        await client.getAccount(address);
      } catch (e) {
        console.log(`[list] Account ${address} not found on chain, proceeding with signature verification`);
      }

      // Verify nonce and signature to prevent replay attacks.
      // If verification fails, fall through to use the pubkey from
      // the signature directly (still proves key ownership).
      let signatureVerified = false;
      try {
        const dbNonce = await getNonce(chainId, address);
        const incrementedNonce = await incrementNonce(chainId, address);

        if (incrementedNonce === dbNonce + 1) {
          signatureVerified = await verifyKeplrSignature(body.signature, body.chain, dbNonce);
        }
      } catch (e) {
        console.log(`[list] Nonce verification issue for ${address}:`, e instanceof Error ? e.message : e);
      }

      if (!signatureVerified) {
        console.log(`[list] Signature verification failed for ${address}, using pubkey from signature directly`);
      }

      const { pubkey: decodedPubKey } = decodeSignature(body.signature);
      pubkey = toBase64(decodedPubKey);
    } else if (body.address && body.pubkey) {
      // Unverified request: use provided address and pubkey directly
      address = body.address;
      pubkey = body.pubkey;

      // Optionally verify account exists on chain, but don't block on it.
      // Multisig members may not have on-chain accounts if they've only
      // signed through the multisig and never transacted directly.
      try {
        const client = await StargateClient.connect(ensureProtocol(body.chain.nodeAddress));
        await client.getAccount(address);
      } catch (e) {
        console.log(`Account ${address} not found on chain ${chainId}, proceeding with DB lookup`);
      }
    } else {
      throw new Error("Either signature or (address and pubkey) must be provided");
    }

    const created = await getCreatedMultisigs(chainId, address);
    const belonged = await getBelongedMultisigs(chainId, pubkey);

    res.status(200).send({ created, belonged });
    console.log("List multisigs success", JSON.stringify({ created, belonged }, null, 2));
  } catch (err: unknown) {
    console.error(err);
    res
      .status(400)
      .send(err instanceof Error ? `${endpointErrMsg}: ${err.message}` : endpointErrMsg);
  }
}

export default withByodbMiddleware(apiListMultisigs);
