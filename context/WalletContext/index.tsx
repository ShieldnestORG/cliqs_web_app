import {
  getKeplrKey,
  getKeplrAminoSigner,
  getKeplrDirectSigner,
  getKeplrVerifySignature,
} from "@/lib/keplr";
import { getConnectError } from "@/lib/errorHelpers";
import { toastError, toastSuccess } from "@/lib/utils";
import { WalletInfo, WalletType, LoadingStates } from "@/types/signing";
import { makeCosmoshubPath, StdSignature } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import { OfflineSigner } from "@cosmjs/proto-signing";
// Note: LedgerSigner and TransportWebUSB are dynamically imported in connectLedger
// to reduce initial bundle size (~150-200 KB savings)
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useChains } from "../ChainsContext";
import { ChainInfo } from "../ChainsContext/types";
import { getDbNonce } from "@/lib/api";

// Storage key for persisting wallet connection preference
const WALLET_STORAGE_KEY = "cosmos-multisig-wallet";

interface StoredWalletInfo {
  type: WalletType;
  chainId: string;
}

interface WalletContextType {
  // Wallet state
  walletInfo: WalletInfo | null;
  isConnecting: boolean;
  loading: LoadingStates;

  // Verification signature for API calls (cached per session)
  verificationSignature: StdSignature | null;
  isVerified: boolean;
  isVerifying: boolean;

  // Offline signer for Ledger (Keplr manages its own signer)
  ledgerSigner: OfflineSigner | null;

  // Actions
  connectKeplr: () => Promise<void>;
  connectLedger: () => Promise<void>;
  disconnect: () => void;
  verify: () => Promise<StdSignature | null>;

  // Convenience helpers
  getAminoSigner: () => Promise<OfflineSigner | null>;
  getAminoSignerForChain: (chain: ChainInfo) => Promise<OfflineSigner | null>;
  getDirectSigner: () => Promise<OfflineSigner | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

interface WalletProviderProps {
  readonly children: ReactNode;
}

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const { chain } = useChains();
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [ledgerSigner, setLedgerSigner] = useState<OfflineSigner | null>(null);
  const [loading, setLoading] = useState<LoadingStates>({});
  const [hasAutoConnected, setHasAutoConnected] = useState(false);

  // Verification state - cached signature for API calls
  const [verificationSignature, setVerificationSignature] = useState<StdSignature | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const isConnecting = loading.keplr || loading.ledger || false;
  const isVerified = verificationSignature !== null;

  // Verify wallet ownership by signing a message (for API calls)
  // Use stable primitive dependencies to avoid recreating callback on every render
  const verify = useCallback(async (): Promise<StdSignature | null> => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      return null;
    }

    // Return cached signature if available
    if (verificationSignature) {
      return verificationSignature;
    }

    try {
      setIsVerifying(true);

      // Verification should not require an on-chain account.
      // New wallets can still prove ownership by signing a nonce challenge.
      const nonce = await getDbNonce(walletInfo.address, chain.chainId);
      const signature = await getKeplrVerifySignature(walletInfo.address, chain, nonce);

      setVerificationSignature(signature);
      return signature;
    } catch (e) {
      console.error("Verification failed:", e);
      toastError({
        description: "Failed to verify wallet ownership",
        fullError: e instanceof Error ? e : undefined,
      });
      return null;
    } finally {
      setIsVerifying(false);
    }
    // Use stable primitive dependencies instead of entire chain object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    walletInfo?.address,
    walletInfo?.type,
    chain.chainId,
    verificationSignature,
  ]);

  // Connect to Keplr wallet.
  // Depend on the full chain object so the suggestion payload is never stale
  // (suggestChainToKeplr uses nodeAddress, restEndpoint, coinType, gasPrice, etc.).
  const connectKeplr = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, keplr: true }));

      const { bech32Address: address, pubKey: pubKeyArray } = await getKeplrKey(chain.chainId, chain);
      const pubKey = toBase64(pubKeyArray);

      const newWalletInfo: WalletInfo = { type: "Keplr", address, pubKey };
      setWalletInfo(newWalletInfo);
      setLedgerSigner(null);
      setVerificationSignature(null); // Clear old verification

      // Persist wallet preference
      const stored: StoredWalletInfo = { type: "Keplr", chainId: chain.chainId };
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(stored));

      toastSuccess("Wallet connected", address);
    } catch (e) {
      const connectError = getConnectError(e);
      console.error(connectError, e);
      toastError({
        description: connectError,
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setLoading((prev) => ({ ...prev, keplr: false }));
    }
  }, [chain]);

  // Connect to Ledger wallet
  // Ledger dependencies are dynamically imported to reduce initial bundle size
  const connectLedger = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, ledger: true }));

      // Dynamic imports for Ledger support (~150-200 KB savings from initial bundle)
      const [{ default: TransportWebUSB }, { LedgerSigner }] = await Promise.all([
        import("@ledgerhq/hw-transport-webusb"),
        import("@cosmjs/ledger-amino"),
      ]);

      const ledgerTransport = await TransportWebUSB.create(120000, 120000);
      const offlineSigner = new LedgerSigner(ledgerTransport, {
        hdPaths: [makeCosmoshubPath(0)],
        prefix: chain.addressPrefix,
      });

      const [{ address, pubkey: pubKeyArray }] = await offlineSigner.getAccounts();
      const pubKey = toBase64(pubKeyArray);

      const newWalletInfo: WalletInfo = { type: "Ledger", address, pubKey };
      setWalletInfo(newWalletInfo);
      setLedgerSigner(offlineSigner);
      setVerificationSignature(null); // Ledger can't do easy verification

      // Persist wallet preference
      const stored: StoredWalletInfo = { type: "Ledger", chainId: chain.chainId };
      localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(stored));

      toastSuccess("Wallet connected", address);
    } catch (e) {
      const connectError = getConnectError(e);
      console.error(connectError, e);
      toastError({
        description: connectError,
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setLoading((prev) => ({ ...prev, ledger: false }));
    }
  }, [chain.addressPrefix, chain.chainId]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setWalletInfo(null);
    setLedgerSigner(null);
    setVerificationSignature(null);
    localStorage.removeItem(WALLET_STORAGE_KEY);
  }, []);

  // Get amino signer for transaction signing (SIGN_MODE_LEGACY_AMINO_JSON)
  const getAminoSignerForChain = useCallback(
    async (targetChain: ChainInfo): Promise<OfflineSigner | null> => {
      if (!walletInfo) return null;

      if (walletInfo.type === "Keplr") {
        return getKeplrAminoSigner(targetChain.chainId, targetChain);
      }

      if (walletInfo.type === "Ledger") {
        return ledgerSigner;
      }

      return null;
    },
    [walletInfo, ledgerSigner],
  );

  const getAminoSigner = useCallback(async (): Promise<OfflineSigner | null> => {
    return getAminoSignerForChain(chain);
  }, [getAminoSignerForChain, chain]);

  // Get direct signer for transaction signing (SIGN_MODE_DIRECT)
  // This may be needed for certain message types that don't work with Amino
  const getDirectSigner = useCallback(async (): Promise<OfflineSigner | null> => {
    if (!walletInfo) return null;

    if (walletInfo.type === "Keplr") {
      return getKeplrDirectSigner(chain.chainId, chain);
    }

    if (walletInfo.type === "Ledger") {
      // Ledger amino signer doesn't support Direct signing well
      // Return null to indicate Direct signing is not available
      console.warn("Ledger does not support Direct signing mode");
      return null;
    }

    return null;
  }, [walletInfo, chain]);

  // Stable ref to always hold the latest connectKeplr without causing effect re-runs.
  // This avoids the stale closure problem that occurred when connectKeplr was removed
  // from dependency arrays to prevent infinite loops.
  const connectKeplrRef = useRef(connectKeplr);
  useEffect(() => {
    connectKeplrRef.current = connectKeplr;
  }, [connectKeplr]);

  // Listen for Keplr account changes
  useEffect(() => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      return;
    }

    const handleAccountChange = () => {
      setVerificationSignature(null);
      connectKeplrRef.current();
    };

    window.addEventListener("keplr_keystorechange", handleAccountChange);

    return () => {
      window.removeEventListener("keplr_keystorechange", handleAccountChange);
    };
  }, [walletInfo]);

  // Auto-reconnect on page load if previously connected (Keplr only)
  useEffect(() => {
    if (hasAutoConnected || !chain.chainId) return;

    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!stored) {
      setHasAutoConnected(true);
      return;
    }

    try {
      const { type, chainId }: StoredWalletInfo = JSON.parse(stored);

      if (type === "Keplr" && chainId === chain.chainId) {
        connectKeplrRef.current();
      }
    } catch (e) {
      console.error("Failed to parse stored wallet info:", e);
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }

    setHasAutoConnected(true);
  }, [chain.chainId, hasAutoConnected]);

  // Clear verification when chain changes
  useEffect(() => {
    setVerificationSignature(null);
  }, [chain.chainId]);

  // Re-connect Keplr when chain changes (different chains have different addresses)
  useEffect(() => {
    const stored = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!stored || !walletInfo) return;

    try {
      const { chainId }: StoredWalletInfo = JSON.parse(stored);
      if (chainId !== chain.chainId && walletInfo.type === "Keplr") {
        const newStored: StoredWalletInfo = { type: "Keplr", chainId: chain.chainId };
        localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(newStored));
        connectKeplrRef.current();
      }
    } catch {
      // Ignore parse errors
    }
  }, [chain.chainId, walletInfo]);

  const value: WalletContextType = {
    walletInfo,
    isConnecting,
    loading,
    verificationSignature,
    isVerified,
    isVerifying,
    ledgerSigner,
    connectKeplr,
    connectLedger,
    disconnect,
    verify,
    getAminoSigner,
    getAminoSignerForChain,
    getDirectSigner,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
