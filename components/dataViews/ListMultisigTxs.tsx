import { useChains } from "@/context/ChainsContext";
import { useWallet } from "@/context/WalletContext";
import { DbTransaction } from "@/graphql";
import { getDbMultisigTxs, getPendingDbTxs } from "@/lib/api";
import { categorizeTransaction, msgTypeCountsFromJson, TransactionCategory } from "@/lib/txMsgHelpers";
import { cn, toastError } from "@/lib/utils";
import { CardLabel } from "@/components/ui/card";
import { Loader2, MoveRightIcon, RefreshCw, Code2, Shield, Wallet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface ListMultisigTxsProps {
  readonly multisigAddress: string;
  readonly multisigThreshold: number;
}

interface TransactionCardProps {
  tx: DbTransaction;
  multisigAddress: string;
  multisigThreshold: number;
  chainName: string;
  walletAddress?: string;
}

const TransactionCard = ({ tx, multisigAddress, multisigThreshold, chainName, walletAddress }: TransactionCardProps) => {
  const msgTypeCounts = msgTypeCountsFromJson(tx.dataJSON);
  const hasSigned = Boolean(tx.signatures.find(({ address }) => address === walletAddress));
  const isCancelled = tx.status === "cancelled";
  const isBroadcast = Boolean(tx.txHash);
  
  const statusColor = isCancelled
    ? "bg-gray-400"
    : isBroadcast
      ? "bg-green-accent"
      : hasSigned
        ? "bg-yellow-500"
        : "bg-blue-500";

  const statusText = isCancelled
    ? "Cancelled"
    : isBroadcast
      ? "Completed"
      : `${tx.signatures.length}/${multisigThreshold} signed`;

  return (
    <Link href={`/${chainName}/${multisigAddress}/transaction/${tx.id}`}>
      <div
        className={cn(
          "group relative rounded-xl border-2 border-border bg-card p-4 transition-all duration-300",
          "hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 hover:border-foreground/20",
          "active:translate-y-0 active:shadow-md",
          "cursor-pointer",
          isCancelled && "opacity-50"
        )}
      >
        {/* Mobile: Vertical layout */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", statusColor)} />
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {statusText}
              {hasSigned && !isBroadcast && !isCancelled && " (you signed)"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {msgTypeCounts.map(({ msgType, count }) => (
              <span
                key={msgType}
                className={cn(
                  "text-xs font-mono font-medium px-2 py-1 rounded bg-muted/50 border border-border/50",
                  isCancelled && "line-through opacity-60"
                )}
              >
                {msgType}{count > 1 && ` ×${count}`}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono truncate">
              {tx.id.split("-")[0]}
            </span>
            <span className="tabular-nums">
              {isCancelled ? "—" : `${tx.signatures.length}/${multisigThreshold}`}
            </span>
          </div>
        </div>

        {/* Desktop: Horizontal linear layout */}
        <div className="hidden md:flex items-center gap-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("h-2 w-2 rounded-full", statusColor)} />
          </div>

          {/* Message types - full width, no truncation */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {msgTypeCounts.map(({ msgType, count }) => (
              <span
                key={msgType}
                className={cn(
                  "text-xs font-mono font-medium px-2 py-1 rounded bg-muted/50 border border-border/50 whitespace-nowrap",
                  isCancelled && "line-through opacity-60"
                )}
              >
                {msgType}{count > 1 && ` ×${count}`}
              </span>
            ))}
          </div>

          {/* Status text */}
          <div className="text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
            {statusText}
            {hasSigned && !isBroadcast && !isCancelled && " (you signed)"}
          </div>

          {/* Transaction ID - full width, no truncation */}
          <div className="text-xs font-mono text-muted-foreground whitespace-nowrap shrink-0 min-w-[120px]">
            {tx.id.split("-")[0]}
          </div>

          {/* Signature count */}
          <div className="text-xs font-mono text-muted-foreground tabular-nums whitespace-nowrap shrink-0 w-12 text-right">
            {isCancelled ? "—" : `${tx.signatures.length}/${multisigThreshold}`}
          </div>

          {/* Arrow icon */}
          <MoveRightIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      </div>
    </Link>
  );
};

const CategorySection = ({
  title,
  icon,
  transactions,
  multisigAddress,
  multisigThreshold,
  chainName,
  walletAddress,
}: {
  title: string;
  icon: React.ReactNode;
  transactions: DbTransaction[];
  multisigAddress: string;
  multisigThreshold: number;
  chainName: string;
  walletAddress?: string;
}) => {
  if (transactions.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <CardLabel comment>{title}</CardLabel>
          <h3 className="text-lg font-heading font-semibold tracking-tight">
            {title} Commands
          </h3>
        </div>
      </div>
      {/* Mobile: Grid layout, Desktop: Linear list */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
        {transactions.map((tx) => (
          <TransactionCard
            key={tx.id}
            tx={tx}
            multisigAddress={multisigAddress}
            multisigThreshold={multisigThreshold}
            chainName={chainName}
            walletAddress={walletAddress}
          />
        ))}
      </div>
    </div>
  );
};

export default function ListMultisigTxs({
  multisigAddress,
  multisigThreshold,
}: ListMultisigTxsProps) {
  const { chain } = useChains();
  const { walletInfo, verify, verificationSignature, isVerifying } = useWallet();

  const [loadingTxs, setLoadingTxs] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pendingTxs, setPendingTxs] = useState<readonly DbTransaction[] | null>(null);
  const [allTxs, setAllTxs] = useState<readonly DbTransaction[] | null>(null);

  // Stable chain values for callbacks
  const chainId = chain.chainId;
  const chainRegistryName = chain.registryName;

  // Fetch pending transactions (no verification needed!)
  const fetchPendingTxs = useCallback(async () => {
    try {
      setLoadingTxs(true);
      const txs = await getPendingDbTxs(multisigAddress, chainId);
      setPendingTxs(txs);
    } catch (e) {
      console.error("Failed to fetch pending transactions:", e);
      toastError({
        description: "Failed to fetch pending transactions",
        fullError: e instanceof Error ? e : undefined,
      });
    } finally {
      setLoadingTxs(false);
    }
  }, [multisigAddress, chainId]);

  // Fetch all transactions (requires verification)
  const fetchAllTxs = useCallback(async () => {
    if (!walletInfo || walletInfo.type !== "Keplr") {
      return;
    }

    try {
      setLoadingTxs(true);

      // Get or request verification signature
      let signature = verificationSignature;
      if (!signature) {
        signature = await verify();
        if (!signature) {
          // User cancelled verification
          setShowAll(false);
          return;
        }
      }

      const txs = await getDbMultisigTxs(multisigAddress, chain, signature);
      setAllTxs(txs);
    } catch (e) {
      console.error("Failed to fetch all transactions:", e);
      toastError({
        description: "Failed to fetch transactions",
        fullError: e instanceof Error ? e : undefined,
      });
      setShowAll(false);
    } finally {
      setLoadingTxs(false);
    }
    // Use stable primitive dependencies - chain object is needed for API call but
    // we track changes via chainId to avoid unnecessary rerenders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multisigAddress, chainId, walletInfo?.address, walletInfo?.type, verify, verificationSignature]);

  // Auto-fetch pending transactions on mount (no verification needed)
  useEffect(() => {
    if (chainId && multisigAddress && !pendingTxs && !loadingTxs) {
      fetchPendingTxs();
    }
  }, [chainId, multisigAddress, pendingTxs, loadingTxs, fetchPendingTxs]);

  // Reset when multisig address changes
  useEffect(() => {
    setPendingTxs(null);
    setAllTxs(null);
    setShowAll(false);
  }, [multisigAddress]);

  // Fetch all transactions when toggling to "show all"
  useEffect(() => {
    if (showAll && !allTxs && !loadingTxs && walletInfo) {
      fetchAllTxs();
    }
  }, [showAll, allTxs, loadingTxs, walletInfo, fetchAllTxs]);

  // Decide which transactions to display
  const displayTxs = showAll ? allTxs : pendingTxs;

  const handleToggleShowAll = (checked: boolean) => {
    if (checked && !walletInfo) {
      // Can't show all without wallet connection
      toastError({ description: "Connect wallet to view all transactions" });
      return;
    }
    setShowAll(checked);
  };

  const handleRefresh = () => {
    if (showAll && walletInfo) {
      fetchAllTxs();
    } else {
      fetchPendingTxs();
    }
  };

  // Categorize transactions
  const categorizedTxs = useMemo(() => {
    if (!displayTxs) return { developer: [], validator: [], standard: [] };

    const categories: Record<TransactionCategory, DbTransaction[]> = {
      developer: [],
      validator: [],
      standard: [],
    };

    displayTxs.forEach((tx) => {
      const category = categorizeTransaction(tx.dataJSON);
      categories[category].push(tx);
    });

    return categories;
  }, [displayTxs]);

  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <CardLabel comment>Transactions</CardLabel>
          <h3 className="text-xl font-heading font-semibold tracking-tight">
            {showAll ? "All Transactions" : "Pending Transactions"}
          </h3>
        </div>
        <div className="flex items-center gap-4">
          {/* Compact status legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-accent"></span>
              <span className="font-mono text-[10px]">done</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
              <span className="font-mono text-[10px]">pending</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
              <span className="font-mono text-[10px]">cancelled</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Switch
                    id="show-all"
                    checked={showAll}
                    onCheckedChange={handleToggleShowAll}
                    className="scale-75"
                    disabled={!walletInfo && !showAll}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider">Show all</span>
                </label>
              </TooltipTrigger>
              {!walletInfo && (
                <TooltipContent>
                  Connect wallet to view all transactions
                </TooltipContent>
              )}
            </Tooltip>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={loadingTxs || isVerifying}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingTxs && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {(loadingTxs || isVerifying) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-mono text-xs uppercase tracking-wider">
            {isVerifying ? "Verifying wallet..." : "Loading..."}
          </span>
        </div>
      )}

      {/* Empty states */}
      {!loadingTxs && !isVerifying && displayTxs && displayTxs.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider">
            {showAll ? "No transactions found" : "No pending transactions"}
          </p>
        </div>
      )}

      {/* Categorized transaction sections */}
      {!loadingTxs && !isVerifying && displayTxs && displayTxs.length > 0 && (
        <div className="space-y-10">
          <CategorySection
            title="Developer"
            icon={<Code2 className="h-4 w-4 text-purple-accent" />}
            transactions={categorizedTxs.developer}
            multisigAddress={multisigAddress}
            multisigThreshold={multisigThreshold}
            chainName={chainRegistryName}
            walletAddress={walletInfo?.address}
          />
          <CategorySection
            title="Validator"
            icon={<Shield className="h-4 w-4 text-green-accent" />}
            transactions={categorizedTxs.validator}
            multisigAddress={multisigAddress}
            multisigThreshold={multisigThreshold}
            chainName={chainRegistryName}
            walletAddress={walletInfo?.address}
          />
          <CategorySection
            title="Standard User"
            icon={<Wallet className="h-4 w-4 text-foreground" />}
            transactions={categorizedTxs.standard}
            multisigAddress={multisigAddress}
            multisigThreshold={multisigThreshold}
            chainName={chainRegistryName}
            walletAddress={walletInfo?.address}
          />
        </div>
      )}
    </div>
  );
}
