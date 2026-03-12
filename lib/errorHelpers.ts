interface ConnectErrorResult {
  message: string;
  isChainIncompatible?: boolean;
}

const getConnectError = (error: unknown): string => {
  return getConnectErrorDetails(error).message;
};

const getConnectErrorDetails = (error: unknown): ConnectErrorResult => {
  const rawErrorMsg =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  // Keplr
  if (rawErrorMsg.includes("window.keplr is undefined")) {
    return { message: "Keplr needs to be installed" };
  }

  // Wallet doesn't support the chain's coin type (e.g., Coreum uses 990)
  // Common error patterns from various wallets:
  // - "Purpose 44 and CoinType 990 is not supported" (Leap, Cosmostation)
  // - "Unsupported chain" / "Chain not supported"
  // - "Invalid coinType" / "coin_type not supported"
  const isCoinTypeError =
    (rawErrorMsg.includes("cointype") && rawErrorMsg.includes("not supported")) ||
    (rawErrorMsg.includes("coin_type") && rawErrorMsg.includes("not supported")) ||
    (rawErrorMsg.includes("purpose") && rawErrorMsg.includes("cointype")) ||
    rawErrorMsg.includes("unsupported chain") ||
    rawErrorMsg.includes("chain not supported") ||
    rawErrorMsg.includes("chain is not supported");

  if (isCoinTypeError) {
    return {
      message:
        "This wallet doesn't support this chain. Try using Keplr or a wallet that supports this network.",
      isChainIncompatible: true,
    };
  }

  // User rejected the request
  if (
    rawErrorMsg.includes("rejected") ||
    rawErrorMsg.includes("user denied") ||
    rawErrorMsg.includes("request rejected")
  ) {
    return { message: "Connection request was rejected" };
  }

  // Ledger
  if (rawErrorMsg.includes("navigator.usb is undefined")) {
    return { message: "Your browser is not compatible with Ledger due to missing WebUSB" };
  }

  if (rawErrorMsg.includes("no device selected")) {
    return { message: "A Ledger device needs to be selected" };
  }

  if (rawErrorMsg.includes("open the cosmos ledger app")) {
    return { message: "The Cosmos Ledger app needs to be open" };
  }

  return { message: "Error when connecting to wallet" };
};

export { getConnectError, getConnectErrorDetails };
