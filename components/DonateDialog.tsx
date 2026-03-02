import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { useBalance } from "@/lib/hooks/useBalance";
import { displayCoinToBaseCoin } from "@/lib/coinHelpers";
import { MsgTypeUrls } from "@/types/txMsg";
import { GasPrice, SigningStargateClient } from "@cosmjs/stargate";
import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { Decimal } from "@cosmjs/math";
import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";
import {
  Heart,
  Copy,
  Check,
  X,
  Loader2,
  ChevronDown,
  ExternalLink,
  ArrowLeft,
  Repeat,
  Zap,
  Shield,
} from "lucide-react";
import { useState, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getStaticTokenMetadata,
  isLPToken,
  formatTokenAmount,
  getTokenLogo,
  getTokenColor,
  getShortDenom,
} from "@/lib/tokenMetadata";

const DONATE_MASTER_ADDRESS = "core1jcas459gnu857ylephjdjlea3rkr38m0asj6gw";

function getDerivedDonateAddress(prefix: string): string {
  try {
    const { data } = fromBech32(DONATE_MASTER_ADDRESS);
    return toBech32(prefix, data);
  } catch {
    return DONATE_MASTER_ADDRESS;
  }
}

interface TokenDisplay {
  baseDenom: string;
  displayDenom: string;
  symbol: string;
  amount: string;
  displayAmount: string;
  exponent: number;
  logo: string | undefined;
}

type DonationType = "one-time" | "recurring";
type Step = "type" | "configure" | "review";

const STEPS: Step[] = ["type", "configure", "review"];

const FREQUENCIES = [
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
] as const;

const DURATIONS = [
  { id: "1m", label: "1 Mo", months: 1 },
  { id: "3m", label: "3 Mo", months: 3 },
  { id: "6m", label: "6 Mo", months: 6 },
  { id: "12m", label: "1 Yr", months: 12 },
] as const;

interface DonateDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function DonateDialog({ open, onClose }: DonateDialogProps) {
  const { chain } = useChains();
  const { walletInfo, getDirectSigner } = useWallet();
  const { balances, loading: balancesLoading } = useBalance({
    address: walletInfo?.address || "",
  });

  const [donationType, setDonationType] = useState<DonationType | null>(null);
  const [step, setStep] = useState<Step>("type");
  const [selectedToken, setSelectedToken] = useState<TokenDisplay | null>(null);
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [duration, setDuration] = useState("3m");
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [showTokenList, setShowTokenList] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ left: 0, top: 0, width: 0 });
  const tokenButtonRef = useRef<HTMLButtonElement>(null);

  const donateAddress = useMemo(
    () => getDerivedDonateAddress(chain.addressPrefix || "core"),
    [chain.addressPrefix],
  );

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(donateAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  }, [donateAddress]);

  const tokens: TokenDisplay[] = useMemo(() => {
    if (!balances || balances.length === 0) return [];

    const processedTokens = balances
      .map((coin) => {
        // Filter out LP tokens using our metadata service
        if (isLPToken(coin.denom)) return null;

        // First check our static token metadata for known bridged assets
        const staticMeta = getStaticTokenMetadata(coin.denom);

        // Then check chain registry assets
        const asset = chain.assets.find(
          (a) => a.base === coin.denom || a.denom_units.some((u) => u.denom === coin.denom),
        );

        // Determine the best metadata source
        let symbol: string;
        let displayDenom: string;
        let exponent: number;
        let logo: string | undefined;

        if (staticMeta) {
          // Use our curated metadata (for bridged XRP, etc.)
          symbol = staticMeta.symbol;
          displayDenom = staticMeta.name;
          exponent = staticMeta.exponent;
          logo = staticMeta.logo || getTokenLogo(staticMeta.symbol);
        } else if (asset) {
          // Use chain registry
          const displayUnit =
            asset.denom_units.find(
              (u) => u.denom === asset.display || u.denom === asset.symbol.toLowerCase(),
            ) ||
            asset.denom_units.find((u) => u.exponent > 0) ||
            asset.denom_units[0];
          symbol = asset.symbol;
          displayDenom = asset.display || asset.symbol;
          exponent = displayUnit?.exponent || 0;
          logo = asset.logo_URIs?.svg || asset.logo_URIs?.png || getTokenLogo(asset.symbol);
        } else {
          // Unknown token - DON'T skip, could be valid bridged token!
          // Use smart pattern detection with 6 decimals (standard for Cosmos)

          // Bridged tokens (drop-core1..., etc.)
          if (coin.denom.includes("-core1") || coin.denom.includes("-coreum")) {
            const prefix = coin.denom.split("-")[0].toUpperCase();
            symbol = prefix.length <= 6 ? prefix : `${prefix.slice(0, 4)}..`;
            displayDenom = "Bridged Token";
            exponent = 6;
            logo = undefined;
          }
          // Factory tokens
          else if (coin.denom.startsWith("factory/")) {
            const parts = coin.denom.split("/");
            const subdenom = parts[parts.length - 1] || "TOKEN";
            symbol = subdenom.toUpperCase().slice(0, 6);
            displayDenom = subdenom;
            exponent = 6;
            logo = undefined;
          }
          // IBC tokens
          else if (coin.denom.startsWith("ibc/")) {
            symbol = "IBC";
            displayDenom = `IBC Token (...${coin.denom.slice(-6)})`;
            exponent = 6;
            logo = undefined;
          }
          // Native micro-denom (utoken)
          else if (coin.denom.startsWith("u") && coin.denom.length < 12) {
            symbol = coin.denom.slice(1).toUpperCase();
            displayDenom = symbol;
            exponent = 6;
            logo = getTokenLogo(symbol);
          }
          // Any other token - show it, don't hide
          else {
            symbol = getShortDenom(coin.denom);
            displayDenom =
              coin.denom.length > 30
                ? `${coin.denom.slice(0, 12)}...${coin.denom.slice(-6)}`
                : coin.denom;
            exponent = 6; // Assume 6 decimals (standard)
            logo = undefined;
          }
        }

        // Calculate display amount
        let displayAmount: string;
        try {
          const dec = Decimal.fromAtomics(coin.amount, exponent);
          displayAmount = dec.toString();
        } catch {
          displayAmount = coin.amount;
        }

        return {
          baseDenom: coin.denom,
          displayDenom,
          symbol,
          amount: coin.amount,
          displayAmount,
          exponent,
          logo,
        };
      })
      .filter((t): t is TokenDisplay => t !== null && t.amount !== "0");

    // Remove duplicates by baseDenom
    const uniqueTokens = Array.from(new Map(processedTokens.map((t) => [t.baseDenom, t])).values());

    // Sort: tokens with logos first, then by symbol
    uniqueTokens.sort((a, b) => {
      if (a.logo && !b.logo) return -1;
      if (!a.logo && b.logo) return 1;
      return a.symbol.localeCompare(b.symbol);
    });

    return uniqueTokens;
  }, [balances, chain.assets]);

  const currentStepIndex = STEPS.indexOf(step);

  const selectedFrequency = FREQUENCIES.find((f) => f.id === frequency);
  const selectedDuration = DURATIONS.find((d) => d.id === duration);

  const periodsCount = useMemo(() => {
    if (!selectedFrequency || !selectedDuration) return 0;
    const totalDays = selectedDuration.months * 30;
    return Math.ceil(totalDays / selectedFrequency.days);
  }, [selectedFrequency, selectedDuration]);

  const expirationDate = useMemo(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + (selectedDuration?.months || 3));
    return now;
  }, [selectedDuration]);

  const totalDisplayAmount = useMemo(() => {
    if (!amount || !periodsCount || donationType !== "recurring") return "";
    const total = parseFloat(amount) * periodsCount;
    return total % 1 === 0 ? total.toString() : total.toFixed(4);
  }, [amount, periodsCount, donationType]);

  const handleSelectType = (type: DonationType) => {
    setDonationType(type);
    setStep("configure");
  };

  const handleSelectToken = (token: TokenDisplay) => {
    setSelectedToken(token);
    setShowTokenList(false);
    setAmount("");
    setTxHash(null);
  };

  const handleToggleTokenList = () => {
    if (!showTokenList && tokenButtonRef.current) {
      const rect = tokenButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        left: rect.left,
        top: rect.bottom + 12,
        width: rect.width,
      });
    }
    setShowTokenList(!showTokenList);
  };

  const handleMaxAmount = () => {
    if (!selectedToken) return;
    setAmount(selectedToken.displayAmount);
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      const prevStep = STEPS[currentStepIndex - 1];
      setStep(prevStep);
      if (prevStep === "type") {
        setDonationType(null);
      }
    }
  };

  const handleContinue = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setStep(STEPS[currentStepIndex + 1]);
    }
  };

  const handleClose = () => {
    setDonationType(null);
    setStep("type");
    setSelectedToken(null);
    setAmount("");
    setFrequency("monthly");
    setDuration("3m");
    setTxHash(null);
    setShowTokenList(false);
    setSending(false);
    onClose();
  };

  const handleSendOneTime = async () => {
    if (!walletInfo || !selectedToken || !amount || parseFloat(amount) <= 0) return;

    setSending(true);
    setTxHash(null);

    try {
      const signer = await getDirectSigner();
      if (!signer) throw new Error("Failed to get signer. Is your wallet connected?");

      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });

      let baseCoin;
      try {
        baseCoin = displayCoinToBaseCoin({ denom: selectedToken.symbol, amount }, chain.assets);
      } catch {
        const dec = Decimal.fromUserInput(amount, selectedToken.exponent);
        baseCoin = { denom: selectedToken.baseDenom, amount: dec.atomics };
      }

      if (baseCoin.amount === "0" || BigInt(baseCoin.amount) <= 0n) {
        throw new Error("Amount must be greater than zero");
      }

      const messages = [
        {
          typeUrl: MsgTypeUrls.Send,
          value: {
            fromAddress: walletInfo.address,
            toAddress: donateAddress,
            amount: [baseCoin],
          },
        },
      ];

      const result = await client.signAndBroadcast(
        walletInfo.address,
        messages,
        "auto",
        "Donation via CLIQS",
      );

      if (result.code !== 0) {
        throw new Error(result.rawLog || `Transaction failed with code ${result.code}`);
      }

      setTxHash(result.transactionHash);
      toast.success("Donation sent! Thank you for your support.");
    } catch (err) {
      console.error("Donation failed:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("Request rejected")) {
        toast.error("Transaction was rejected in your wallet.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleGrantRecurring = async () => {
    if (!walletInfo || !selectedToken || !amount || parseFloat(amount) <= 0) return;

    setSending(true);
    setTxHash(null);

    try {
      const signer = await getDirectSigner();
      if (!signer) throw new Error("Failed to get signer. Is your wallet connected?");

      const client = await SigningStargateClient.connectWithSigner(chain.nodeAddress, signer, {
        gasPrice: GasPrice.fromString(chain.gasPrice),
      });

      const expirySeconds = BigInt(Math.floor(expirationDate.getTime() / 1000));

      const grantMsg = {
        typeUrl: "/cosmos.authz.v1beta1.MsgGrant",
        value: MsgGrant.fromPartial({
          granter: walletInfo.address,
          grantee: donateAddress,
          grant: {
            authorization: {
              typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
              value: GenericAuthorization.encode(
                GenericAuthorization.fromPartial({
                  msg: "/cosmos.bank.v1beta1.MsgSend",
                }),
              ).finish(),
            },
            expiration: Timestamp.fromPartial({
              seconds: expirySeconds,
              nanos: 0,
            }),
          },
        }),
      };

      const result = await client.signAndBroadcast(
        walletInfo.address,
        [grantMsg],
        "auto",
        "Recurring donation authorization via CLIQS",
      );

      if (result.code !== 0) {
        throw new Error(result.rawLog || `Transaction failed with code ${result.code}`);
      }

      setTxHash(result.transactionHash);
      toast.success("Recurring donation authorized! Thank you for your support.");
    } catch (err) {
      console.error("Authz grant failed:", err);
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("Request rejected")) {
        toast.error("Transaction was rejected in your wallet.");
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = () => {
    if (donationType === "recurring") {
      handleGrantRecurring();
    } else {
      handleSendOneTime();
    }
  };

  const canContinue = selectedToken && amount && parseFloat(amount) > 0;

  if (!open) return null;

  const explorerUrl =
    chain.explorerLinks?.tx && txHash ? chain.explorerLinks.tx.replace("${txHash}", txHash) : null;

  const formattedExpiry = expirationDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={handleClose} />

      <div className="relative w-full max-w-3xl rounded-3xl border border-border bg-card shadow-[0_0_50px_rgba(0,0,0,0.5)] duration-300 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div
          className="flex items-center justify-between overflow-hidden rounded-t-3xl p-8 md:p-12"
          style={{
            background: "linear-gradient(135deg, #ff876d 0%, #ff6b4a 100%)",
          }}
        >
          <div className="flex items-center gap-6">
            {currentStepIndex > 0 && !txHash && (
              <button
                onClick={handleBack}
                className="flex h-12 w-12 items-center justify-center rounded-2xl transition-all hover:bg-black/10 active:scale-90"
              >
                <ArrowLeft className="h-6 w-6" style={{ color: "#4a1a0e" }} />
              </button>
            )}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/5">
              <Heart className="h-8 w-8" style={{ color: "#4a1a0e" }} />
            </div>
            <div>
              <h2
                className="text-3xl font-black tracking-tight md:text-4xl"
                style={{ color: "#4a1a0e" }}
              >
                {txHash
                  ? "Thank You!"
                  : step === "type"
                    ? "Support CLIQS"
                    : donationType === "recurring"
                      ? "Recurring Support"
                      : "One-Time Donation"}
              </h2>
              <p
                className="mt-1 text-sm font-medium opacity-80 md:text-base"
                style={{ color: "#6b3a2a" }}
              >
                {txHash
                  ? "Your contribution keeps the vision alive."
                  : step === "type"
                    ? "Choose your preferred contribution model"
                    : step === "configure"
                      ? "Tell us how you'd like to help"
                      : "Everything look correct?"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex h-12 w-12 items-center justify-center rounded-2xl transition-all hover:bg-black/10 active:scale-90"
          >
            <X className="h-6 w-6" style={{ color: "#4a1a0e" }} />
          </button>
        </div>

        {/* Step Indicator */}
        {!txHash && walletInfo && (
          <div className="flex items-center justify-center gap-3 pb-2 pt-8">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  currentStepIndex >= i ? "w-16 bg-[#ff876d]" : "w-6 bg-border",
                )}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-8 md:p-12">
          {/* ─── Success State ─── */}
          {txHash ? (
            <div className="space-y-8 py-4 text-center">
              <div className="mx-auto flex h-24 w-24 animate-bounce items-center justify-center rounded-3xl bg-green-500/10">
                <Check className="h-12 w-12 text-green-500" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">
                  {donationType === "recurring" ? "Legacy Authorized" : "Contribution Received"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-lg text-muted-foreground">
                  {donationType === "recurring"
                    ? `You've set up a recurring legacy of support until ${formattedExpiry}.`
                    : "Your one-time donation has been successfully broadcast to the network."}
                </p>
              </div>
              <div className="rounded-3xl border border-border/50 bg-muted/30 p-6 text-left">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Transaction Receipt
                </p>
                <p className="break-all rounded-xl border border-border/50 bg-background/50 p-4 font-mono text-sm text-foreground/90">
                  {txHash}
                </p>
              </div>
              <div className="flex flex-col gap-4 md:flex-row">
                {explorerUrl && (
                  <Button
                    asChild
                    variant="outline"
                    className="h-16 flex-1 rounded-2xl text-base font-bold"
                  >
                    <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                      View on Explorer
                      <ExternalLink className="ml-2 h-5 w-5" />
                    </a>
                  </Button>
                )}
                <Button
                  onClick={handleClose}
                  className="h-16 flex-1 rounded-2xl border-none bg-zinc-900 text-base font-bold text-white shadow-xl transition-all hover:bg-zinc-800 active:scale-95"
                >
                  Return to Dashboard
                </Button>
              </div>
            </div>
          ) : !walletInfo ? (
            /* ─── No Wallet ─── */
            <div className="space-y-8 py-8 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
                <Shield className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Wallet Required</h3>
                <p className="mx-auto max-w-xs text-muted-foreground">
                  Please connect your wallet to interact with the blockchain and make a
                  contribution.
                </p>
              </div>
              <div className="rounded-3xl border border-border/50 bg-muted/30 p-8">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Manual Contribution Address ({chain.chainDisplayName || "Core"})
                </p>
                <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-background/50 p-4">
                  <p className="flex-1 truncate font-mono text-sm text-foreground/80">
                    {donateAddress}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 hover:bg-[#ff876d]/10 hover:text-[#ff876d]"
                    onClick={copyAddress}
                  >
                    {copiedAddress ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : step === "type" ? (
            /* ─── Step 1: Choose Type ─── */
            <div className="grid grid-cols-1 gap-6 pt-4 md:grid-cols-2">
              <button
                onClick={() => handleSelectType("one-time")}
                className="group relative rounded-3xl border-2 border-border bg-muted/10 p-8 text-left transition-all duration-300 hover:border-[#ff876d] hover:bg-[#ff876d]/5 active:scale-[0.98]"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff876d]/10 transition-colors group-hover:bg-[#ff876d]/20">
                  <Zap className="h-8 w-8 text-[#ff876d]" />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-foreground">One-Time</h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Support the project with a single on-chain donation of any size.
                </p>
              </button>

              <button
                onClick={() => handleSelectType("recurring")}
                className="group relative rounded-3xl border-2 border-border bg-muted/10 p-8 text-left transition-all duration-300 hover:border-[#ff876d] hover:bg-[#ff876d]/5 active:scale-[0.98]"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff876d]/10 transition-colors group-hover:bg-[#ff876d]/20">
                  <Repeat className="h-8 w-8 text-[#ff876d]" />
                </div>
                <h3 className="mb-2 text-2xl font-bold text-foreground">Recurring</h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Set up a recurring stream of support using secure authz technology.
                </p>
              </button>
            </div>
          ) : step === "configure" ? (
            /* ─── Step 2: Configure ─── */
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Token selector */}
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    Select Asset
                  </label>
                  <div className="relative">
                    <button
                      ref={tokenButtonRef}
                      onClick={handleToggleTokenList}
                      className={cn(
                        "flex h-[72px] w-full items-center justify-between rounded-2xl border-2 border-border bg-muted/20 p-5 text-left transition-all hover:bg-muted/40",
                        showTokenList && "border-[#ff876d] ring-4 ring-[#ff876d]/10",
                      )}
                    >
                      {selectedToken ? (
                        <div className="flex items-center gap-4">
                          {selectedToken.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- token logos from external URLs with onError fallback
                            <img
                              src={selectedToken.logo}
                              alt={selectedToken.symbol}
                              className="h-10 w-10 rounded-full bg-card shadow-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white shadow-lg"
                            style={{
                              background: `linear-gradient(135deg, ${getTokenColor(selectedToken.symbol)} 0%, ${getTokenColor(selectedToken.symbol)}dd 100%)`,
                              display: selectedToken.logo ? "none" : "flex",
                            }}
                          >
                            {selectedToken.symbol.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-foreground">
                                {selectedToken.symbol}
                              </span>
                              {(selectedToken.displayDenom.toLowerCase().includes("bridged") ||
                                selectedToken.baseDenom.startsWith("drop-") ||
                                selectedToken.baseDenom.includes("-core1")) && (
                                <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-blue-400">
                                  Bridged
                                </span>
                              )}
                              {selectedToken.baseDenom.startsWith("ibc/") && (
                                <span className="rounded-full bg-purple-500/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-purple-400">
                                  IBC
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatTokenAmount(selectedToken.displayAmount)} available
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-lg font-bold text-muted-foreground">
                          {balancesLoading ? "Fetching..." : "Choose Token"}
                        </span>
                      )}
                      {balancesLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <ChevronDown
                          className={cn(
                            "h-6 w-6 text-muted-foreground transition-transform duration-300",
                            showTokenList && "rotate-180",
                          )}
                        />
                      )}
                    </button>

                    {showTokenList &&
                      createPortal(
                        <div
                          className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md"
                          onClick={() => setShowTokenList(false)}
                        >
                          <div
                            className="absolute max-h-[70vh] overflow-y-auto rounded-3xl border-2 border-border bg-card shadow-2xl duration-200 animate-in slide-in-from-top-2"
                            style={{
                              left: `${dropdownPosition.left}px`,
                              top: `${dropdownPosition.top}px`,
                              width: `${Math.max(dropdownPosition.width, 360)}px`,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Header */}
                            <div className="sticky top-0 rounded-t-3xl border-b border-border bg-card p-4">
                              <h3 className="text-lg font-black text-foreground">Select Token</h3>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {tokens.length} token{tokens.length !== 1 ? "s" : ""} available
                              </p>
                            </div>

                            {tokens.length === 0 ? (
                              <div className="p-12 text-center">
                                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                                  <span className="text-3xl">💰</span>
                                </div>
                                <p className="text-base font-bold text-muted-foreground">
                                  No tokens available
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1 p-3">
                                {tokens.map((token) => {
                                  const tokenColor = getTokenColor(token.symbol);
                                  return (
                                    <button
                                      key={token.baseDenom}
                                      onClick={() => handleSelectToken(token)}
                                      className="group flex w-full items-center gap-4 rounded-2xl p-4 text-left transition-all hover:bg-muted/50 active:bg-muted"
                                    >
                                      {/* Token Icon */}
                                      <div className="relative shrink-0">
                                        {token.logo ? (
                                          // eslint-disable-next-line @next/next/no-img-element -- token logos from external URLs with onError fallback
                                          <img
                                            src={token.logo}
                                            alt={token.symbol}
                                            className="h-12 w-12 rounded-full bg-card shadow-lg transition-transform group-hover:scale-105"
                                            onError={(e) => {
                                              e.currentTarget.style.display = "none";
                                              const fallback = e.currentTarget
                                                .nextElementSibling as HTMLElement;
                                              if (fallback) fallback.style.display = "flex";
                                            }}
                                          />
                                        ) : null}
                                        <div
                                          className={cn(
                                            "flex h-12 w-12 items-center justify-center rounded-full text-sm font-black text-white shadow-lg",
                                            token.logo ? "hidden" : "flex",
                                          )}
                                          style={{
                                            background: `linear-gradient(135deg, ${tokenColor} 0%, ${tokenColor}dd 100%)`,
                                            display: token.logo ? "none" : "flex",
                                          }}
                                        >
                                          {token.symbol.slice(0, 2).toUpperCase()}
                                        </div>
                                      </div>

                                      {/* Token Info */}
                                      <div className="min-w-0 flex-1">
                                        <div className="mb-0.5 flex items-center gap-2">
                                          <span className="text-lg font-black text-foreground">
                                            {token.symbol}
                                          </span>
                                          {(token.displayDenom.toLowerCase().includes("bridged") ||
                                            token.baseDenom.startsWith("drop-") ||
                                            token.baseDenom.includes("-core1")) && (
                                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400">
                                              Bridged
                                            </span>
                                          )}
                                          {token.baseDenom.startsWith("ibc/") && (
                                            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-400">
                                              IBC
                                            </span>
                                          )}
                                        </div>
                                        <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
                                          {token.displayDenom}
                                        </span>
                                      </div>

                                      {/* Balance */}
                                      <div className="shrink-0 text-right">
                                        <span className="block text-lg font-black tabular-nums text-foreground">
                                          {formatTokenAmount(token.displayAmount)}
                                        </span>
                                        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                          Balance
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>,
                        document.body,
                      )}
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-3">
                  <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                    {donationType === "recurring" ? "Period Amount" : "Amount"}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*\.?\d*$/.test(val)) setAmount(val);
                      }}
                      className="h-[72px] w-full rounded-2xl border-2 border-border bg-muted/20 p-5 pr-24 text-2xl font-bold text-foreground transition-all focus:border-[#ff876d] focus:outline-none focus:ring-4 focus:ring-[#ff876d]/10"
                    />
                    <button
                      onClick={handleMaxAmount}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-[#ff876d]/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-[#ff876d] transition-all hover:bg-[#ff876d]/20 active:scale-90"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Recurring options */}
              {donationType === "recurring" && selectedToken && (
                <div className="grid grid-cols-1 gap-8 pt-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Frequency
                    </label>
                    <div className="flex gap-4">
                      {FREQUENCIES.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFrequency(f.id)}
                          className={cn(
                            "flex-1 rounded-2xl border-2 py-4 text-base font-bold transition-all",
                            frequency === f.id
                              ? "border-[#ff876d] bg-[#ff876d]/10 text-[#ff876d]"
                              : "border-border bg-muted/10 text-muted-foreground hover:border-border/80",
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      Duration
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {DURATIONS.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setDuration(d.id)}
                          className={cn(
                            "min-w-[80px] flex-1 rounded-2xl border-2 py-4 text-base font-bold transition-all",
                            duration === d.id
                              ? "border-[#ff876d] bg-[#ff876d]/10 text-[#ff876d]"
                              : "border-border bg-muted/10 text-muted-foreground hover:border-border/80",
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Continue button */}
              <Button
                onClick={handleContinue}
                disabled={!canContinue}
                className="mt-4 h-20 w-full rounded-3xl border-none bg-zinc-900 text-xl font-black text-white shadow-2xl transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
              >
                Continue to Review
              </Button>
            </div>
          ) : (
            /* ─── Step 3: Review ─── */
            <div className="space-y-8">
              {/* Summary card */}
              <div className="space-y-6 rounded-3xl border-2 border-[#ff876d]/30 bg-[#ff876d]/5 p-8">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-muted-foreground">
                    {donationType === "recurring" ? "Periodic Commitment" : "Contribution Amount"}
                  </span>
                  <span className="text-2xl font-black text-foreground">
                    {amount} {selectedToken?.symbol}
                  </span>
                </div>

                {donationType === "recurring" && (
                  <>
                    <div className="h-px bg-border/50" />
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Frequency
                        </span>
                        <p className="text-lg font-bold text-foreground">
                          {selectedFrequency?.label}
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Ends On
                        </span>
                        <p className="text-lg font-bold text-foreground">{formattedExpiry}</p>
                      </div>
                    </div>
                    <div className="h-px bg-border/50" />
                    <div className="flex items-center justify-between rounded-2xl border border-[#ff876d]/20 bg-[#ff876d]/10 p-6">
                      <span className="text-sm font-bold text-white/80">
                        Estimated Total Over Period
                      </span>
                      <span className="text-2xl font-black text-white">
                        ~{totalDisplayAmount} {selectedToken?.symbol}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Recipient info */}
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Recipient ({chain.chainDisplayName || "Core"})
                </p>
                <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-background/50 p-4">
                  <p className="flex-1 truncate font-mono text-xs text-foreground/70 md:text-sm">
                    {donateAddress}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 hover:bg-[#ff876d]/10"
                    onClick={copyAddress}
                  >
                    {copiedAddress ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Copy className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Authz info for recurring */}
              {donationType === "recurring" && (
                <div className="flex items-start gap-4 rounded-2xl border border-border/30 bg-muted/20 p-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    This transaction creates an on-chain{" "}
                    <span className="font-bold text-foreground">authz</span> grant. CLIQS will be
                    authorized to execute sends to the donation address on your behalf. Your funds
                    stay in your wallet until each period.
                  </p>
                </div>
              )}

              {/* Confirm button */}
              <Button
                onClick={handleConfirm}
                disabled={sending}
                className="flex h-20 w-full items-center justify-center gap-4 rounded-3xl border-none bg-zinc-900 text-xl font-black text-white shadow-2xl transition-all hover:bg-zinc-800 active:scale-[0.98]"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {donationType === "recurring" ? (
                      <Shield className="h-6 w-6" />
                    ) : (
                      <Heart className="h-6 w-6 fill-current" />
                    )}
                    {donationType === "recurring" ? "Authorize Contribution" : "Confirm Donation"}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
