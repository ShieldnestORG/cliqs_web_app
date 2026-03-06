import { ChainInfo } from "@/context/ChainsContext/types";
import { StdSignature, decodeSignature, pubkeyToAddress } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import { StdSignDoc } from "@keplr-wallet/types";
import { useLayoutEffect } from "react";
// Note: verifyADR36Amino is dynamically imported in verifyKeplrSignature
// to reduce initial bundle size

/**
 * Derive a best-effort REST/LCD URL from an RPC URL.
 * Many nodes serve REST on port 1317 when RPC is on 26657.
 */
const deriveRestFromRpc = (rpcUrl: string): string => {
  try {
    const url = new URL(rpcUrl);
    if (url.port === "26657") {
      url.port = "1317";
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // Fall through
  }
  return rpcUrl;
};

/**
 * Parse a gas price string like "0.0625utestcore" into a numeric value.
 * Returns 0.025 as a safe fallback.
 */
const parseGasPriceAmount = (gasPrice: string): number => {
  const match = gasPrice.match(/^([0-9.]+)/);
  return match ? parseFloat(match[1]) : 0.025;
};

/**
 * Suggest a chain to Keplr via experimentalSuggestChain.
 * Used for testnets and custom chains that Keplr doesn't have built-in.
 */
export const suggestChainToKeplr = async (chain: ChainInfo): Promise<void> => {
  const keplr = window.keplr;
  if (!keplr) {
    throw new Error("Keplr not found");
  }

  const rpc = chain.nodeAddress || chain.nodeAddresses[0] || "";
  const rest = chain.restEndpoint || deriveRestFromRpc(rpc);
  const coinType = chain.coinType ?? 118;
  const gasAmount = parseGasPriceAmount(chain.gasPrice);
  const { addressPrefix: prefix } = chain;

  await keplr.experimentalSuggestChain({
    chainId: chain.chainId,
    chainName: chain.chainDisplayName,
    rpc,
    rest,
    bip44: { coinType },
    bech32Config: {
      bech32PrefixAccAddr: prefix,
      bech32PrefixAccPub: `${prefix}pub`,
      bech32PrefixValAddr: `${prefix}valoper`,
      bech32PrefixValPub: `${prefix}valoperpub`,
      bech32PrefixConsAddr: `${prefix}valcons`,
      bech32PrefixConsPub: `${prefix}valconspub`,
    },
    currencies: [
      {
        coinDenom: chain.displayDenom,
        coinMinimalDenom: chain.denom,
        coinDecimals: chain.displayDenomExponent,
      },
    ],
    feeCurrencies: [
      {
        coinDenom: chain.displayDenom,
        coinMinimalDenom: chain.denom,
        coinDecimals: chain.displayDenomExponent,
        gasPriceStep: {
          low: gasAmount * 0.5,
          average: gasAmount,
          high: gasAmount * 2,
        },
      },
    ],
    stakeCurrency: {
      coinDenom: chain.displayDenom,
      coinMinimalDenom: chain.denom,
      coinDecimals: chain.displayDenomExponent,
    },
  });
};

export const getKeplr = async (chainId: string, chain?: ChainInfo) => {
  const keplr = window.keplr;
  if (!keplr) {
    throw new Error("Keplr not found");
  }

  // Set defaultOptions BEFORE enable() so Keplr respects them during the flow.
  // This prevents a balance-check popup that would appear before the sign approval popup.
  keplr.defaultOptions = {
    sign: { preferNoSetFee: true, preferNoSetMemo: true, disableBalanceCheck: true },
  };

  try {
    await keplr.enable(chainId);
  } catch (e) {
    // Keplr doesn't know this chain — suggest it and retry.
    // This happens for testnets and custom chains not built into Keplr.
    const msg = e instanceof Error ? e.message : String(e);
    if (
      chain &&
      (msg.includes("no modular chain info") ||
        msg.includes("There is no chain info") ||
        msg.includes("no chain info"))
    ) {
      await suggestChainToKeplr(chain);
      await keplr.enable(chainId);
    } else {
      throw e;
    }
  }

  return keplr;
};

export const getKeplrKey = async (chainId: string, chain?: ChainInfo) => {
  const keplr = await getKeplr(chainId, chain);
  const keplrKey = await keplr.getKey(chainId);

  return keplrKey;
};

export const getKeplrAminoSigner = async (chainId: string, chain?: ChainInfo) => {
  const keplr = await getKeplr(chainId, chain);
  const aminoSigner = keplr.getOfflineSignerOnlyAmino(chainId);

  return aminoSigner;
};

/**
 * Get a Direct signer from Keplr (supports SIGN_MODE_DIRECT)
 * This is needed for certain message types that don't work well with Amino encoding.
 */
export const getKeplrDirectSigner = async (chainId: string, chain?: ChainInfo) => {
  const keplr = await getKeplr(chainId, chain);
  // getOfflineSigner returns a signer that supports both Direct and Amino,
  // but will prefer Direct signing when possible
  const directSigner = keplr.getOfflineSigner(chainId);

  return directSigner;
};

/**
 * Get an auto signer from Keplr that automatically chooses the best signing mode
 */
export const getKeplrAutoSigner = async (chainId: string, chain?: ChainInfo) => {
  const keplr = await getKeplr(chainId, chain);
  // getOfflineSignerAuto will automatically choose the best signing mode
  const autoSigner = await keplr.getOfflineSignerAuto(chainId);

  return autoSigner;
};

export const getKeplrVerifySignature = async (signer: string, chain: ChainInfo, nonce: number) => {
  const keplr = await getKeplr(chain.chainId, chain);

  const { signature } = await keplr.signAmino(
    chain.chainId,
    signer,
    getKeplrVerifyMsg(signer, chain.chainDisplayName, nonce),
  );

  return signature;
};

const getKeplrVerifyMsg = (
  signer: string,
  chainDisplayName: string,
  nonce: number,
): StdSignDoc => ({
  chain_id: "",
  account_number: "0",
  sequence: "0",
  fee: { gas: "0", amount: [] },
  memo: "",
  msgs: [
    {
      type: "sign/MsgSignData",
      value: {
        signer,
        data: toBase64(new Uint8Array(Buffer.from(getKeplrVerifyData(chainDisplayName, nonce)))),
      },
    },
  ],
});

const getKeplrVerifyData = (chainDisplayName: string, nonce: number) =>
  JSON.stringify({
    title: `Keplr Login to ${chainDisplayName}`,
    description: "Sign this no fee transaction to login with your Keplr wallet",
    nonce,
  });

export const verifyKeplrSignature = async (
  signature: StdSignature,
  chain: ChainInfo,
  nonce: number,
) => {
  const signer = pubkeyToAddress(signature.pub_key, chain.addressPrefix);
  const data = getKeplrVerifyData(chain.chainDisplayName, nonce);
  const { pubkey: decodedPubKey, signature: decodedSignature } = decodeSignature(signature);

  // Dynamic import of @keplr-wallet/cosmos to reduce initial bundle size
  const { verifyADR36Amino } = await import("@keplr-wallet/cosmos");

  const verified = verifyADR36Amino(
    chain.addressPrefix,
    signer,
    data,
    decodedPubKey,
    decodedSignature,
  );

  return verified;
};

const accountChangeKey = "keplr_keystorechange";
export const useKeplrReconnect = (condition: boolean, connectWallet: () => Promise<void>) => {
  useLayoutEffect(() => {
    if (!condition) {
      return;
    }

    window.addEventListener(accountChangeKey, connectWallet);

    return () => {
      window.removeEventListener(accountChangeKey, connectWallet);
    };
  }, [condition, connectWallet]);
};
