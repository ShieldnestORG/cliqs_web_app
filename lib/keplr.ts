import { ChainInfo } from "@/context/ChainsContext/types";
import { StdSignature, decodeSignature, pubkeyToAddress } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import { StdSignDoc } from "@keplr-wallet/types";
import { useLayoutEffect } from "react";
// Note: verifyADR36Amino is dynamically imported in verifyKeplrSignature
// to reduce initial bundle size

export const getKeplr = async (chainId: string) => {
  const keplr = window.keplr;
  if (!keplr) {
    throw new Error("Keplr not found");
  }

  // Set defaultOptions BEFORE enable() so Keplr respects them during the flow.
  // This prevents a balance-check popup that would appear before the sign approval popup.
  keplr.defaultOptions = {
    sign: { preferNoSetFee: true, preferNoSetMemo: true, disableBalanceCheck: true },
  };

  await keplr.enable(chainId);

  return keplr;
};

export const getKeplrKey = async (chainId: string) => {
  const keplr = await getKeplr(chainId);
  const keplrKey = await keplr.getKey(chainId);

  return keplrKey;
};

export const getKeplrAminoSigner = async (chainId: string) => {
  const keplr = await getKeplr(chainId);
  const aminoSigner = keplr.getOfflineSignerOnlyAmino(chainId);

  return aminoSigner;
};

/**
 * Get a Direct signer from Keplr (supports SIGN_MODE_DIRECT)
 * This is needed for certain message types that don't work well with Amino encoding.
 */
export const getKeplrDirectSigner = async (chainId: string) => {
  const keplr = await getKeplr(chainId);
  // getOfflineSigner returns a signer that supports both Direct and Amino,
  // but will prefer Direct signing when possible
  const directSigner = keplr.getOfflineSigner(chainId);

  return directSigner;
};

/**
 * Get an auto signer from Keplr that automatically chooses the best signing mode
 */
export const getKeplrAutoSigner = async (chainId: string) => {
  const keplr = await getKeplr(chainId);
  // getOfflineSignerAuto will automatically choose the best signing mode
  const autoSigner = await keplr.getOfflineSignerAuto(chainId);

  return autoSigner;
};

export const getKeplrVerifySignature = async (signer: string, chain: ChainInfo, nonce: number) => {
  const keplr = await getKeplr(chain.chainId);

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
