import { getBelongedMultisigs, getCreatedMultisigs } from "@/graphql/multisig";
import type { DbMultisig } from "@/graphql/multisig";
import { getNonce, incrementNonce } from "@/graphql/nonce";
import {
  discoverMultisigsWhereMember,
  registerDiscoveredMultisigs,
} from "@/lib/chainMultisigDiscovery";
import { GetDbUserMultisigsBody } from "@/lib/api";
import { withByodbMiddleware } from "@/lib/byodb/middleware";
import { ensureDbReady } from "@/lib/dbInit";
import { verifyKeplrSignature } from "@/lib/keplr";
import { decodeSignature, pubkeyToAddress } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Maximum time to wait for on-chain multisig discovery before returning
 * DB-only results. Chain RPC calls can be slow on public endpoints; we
 * don't want them to block the entire response past the client timeout.
 */
const CHAIN_DISCOVERY_TIMEOUT_MS = 8000;

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
      throw new Error(
        "Chain nodeAddress is not configured. Please wait for the chain to finish loading.",
      );
    }

    // Support both signature-based (verified) and direct address/pubkey (unverified) requests
    let address: string;
    let pubkey: string;

    if (body.signature) {
      // Verified request: extract address and pubkey from signature
      address = pubkeyToAddress(body.signature.pub_key, body.chain.addressPrefix);

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
        console.log(
          `[list] Nonce verification issue for ${address}:`,
          e instanceof Error ? e.message : e,
        );
      }

      if (!signatureVerified) {
        console.log(
          `[list] Signature verification failed for ${address}, using pubkey from signature directly`,
        );
      }

      const { pubkey: decodedPubKey } = decodeSignature(body.signature);
      pubkey = toBase64(decodedPubKey);
    } else if (body.address && body.pubkey) {
      // Unverified request: use provided address and pubkey directly
      address = body.address;
      pubkey = body.pubkey;
    } else {
      throw new Error("Either signature or (address and pubkey) must be provided");
    }

    // Wrap chain discovery in a timeout so a slow RPC never causes the whole
    // request to exceed the client's 30-second hard limit.
    const chainDiscoveryWithTimeout = Promise.race([
      discoverMultisigsWhereMember(body.chain, address, pubkey),
      new Promise<DbMultisig[]>((resolve) =>
        setTimeout(() => {
          console.log("[list] External discovery timed out — returning DB results only");
          resolve([]);
        }, CHAIN_DISCOVERY_TIMEOUT_MS),
      ),
    ]);

    const [dbResult, chainResult] = await Promise.allSettled([
      Promise.all([getCreatedMultisigs(chainId, address), getBelongedMultisigs(chainId, pubkey)]),
      chainDiscoveryWithTimeout,
    ]);

    const created = dbResult.status === "fulfilled" ? dbResult.value[0] : [];
    let belonged = dbResult.status === "fulfilled" ? dbResult.value[1] : [];
    const chainMultisigs = chainResult.status === "fulfilled" ? chainResult.value : [];

    if (chainMultisigs.length > 0) {
      try {
        await registerDiscoveredMultisigs(chainMultisigs);
      } catch (e) {
        console.log(
          "[list] Failed to register discovered multisigs in DB:",
          e instanceof Error ? e.message : e,
        );
      }
    }

    const existingAddresses = new Set([
      ...created.map((m) => m.address),
      ...belonged.map((m) => m.address),
    ]);
    const chainOnly = chainMultisigs.filter((m) => !existingAddresses.has(m.address));
    belonged = [...belonged, ...chainOnly];

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
