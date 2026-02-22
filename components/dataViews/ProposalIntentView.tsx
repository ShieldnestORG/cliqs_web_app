/**
 * ProposalIntentView Component
 * 
 * File: components/dataViews/ProposalIntentView.tsx
 * 
 * Displays transaction intent in a human-readable format for signer verification.
 * Implements mandatory "intent view" before signing to prevent payload deception.
 * 
 * Features:
 * - Human-readable transaction summary
 * - Raw message preview (JSON)
 * - Payload hash display for independent verification
 * - "I have verified this transaction" checkbox gate
 */

import { useState, useMemo } from "react";
import { EncodeObject } from "@cosmjs/proto-signing";
import { StdFee } from "@cosmjs/amino";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Hash,
  Shield,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardLabel } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeProposalHash } from "@/lib/tx/proposal-hasher";

// ============================================================================
// Types
// ============================================================================

export interface ProposalIntentViewProps {
  /** Transaction messages */
  msgs: readonly EncodeObject[];
  /** Transaction fee */
  fee: StdFee;
  /** Transaction memo */
  memo: string;
  /** Chain ID */
  chainId: string;
  /** Account number */
  accountNumber: number;
  /** Sequence */
  sequence: number;
  /** Called when user verifies the transaction */
  onVerified: (verified: boolean) => void;
  /** Whether verification is required before proceeding */
  requireVerification?: boolean;
  /** Whether the view is compact (for embedded use) */
  compact?: boolean;
  /** Sign mode being used */
  signMode?: "amino" | "direct";
}

interface MessageSummary {
  type: string;
  description: string;
  icon: React.ReactNode;
  details: Record<string, string>;
  risk: "low" | "medium" | "high";
}

// ============================================================================
// Component
// ============================================================================

export function ProposalIntentView({
  msgs,
  fee,
  memo,
  chainId,
  accountNumber,
  sequence,
  onVerified,
  requireVerification = true,
  compact = false,
  signMode = "amino",
}: ProposalIntentViewProps) {
  const [verified, setVerified] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // Compute payload hash
  const payloadHash = useMemo(() => {
    return computeProposalHash({
      msgs,
      fee,
      memo,
      chainId,
      accountNumber,
      sequence,
    });
  }, [msgs, fee, memo, chainId, accountNumber, sequence]);

  // Parse messages into human-readable summaries
  const messageSummaries = useMemo(() => {
    return msgs.map((msg) => parseMessage(msg));
  }, [msgs]);

  // Handle verification toggle
  const handleVerificationChange = (checked: boolean) => {
    setVerified(checked);
    onVerified(checked);
  };

  // Calculate overall risk level
  const overallRisk = useMemo(() => {
    const risks = messageSummaries.map((m) => m.risk);
    if (risks.includes("high")) return "high";
    if (risks.includes("medium")) return "medium";
    return "low";
  }, [messageSummaries]);

  // Format fee display
  const feeDisplay = fee.amount
    .map((c) => `${formatAmount(c.amount)} ${c.denom}`)
    .join(", ");

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Quick Summary */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {msgs.length} action{msgs.length !== 1 ? "s" : ""}
            </span>
            <Badge variant={overallRisk === "high" ? "destructive" : "secondary"}>
              {signMode.toUpperCase()}
            </Badge>
          </div>
          {messageSummaries.map((msg, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {msg.icon}
              <span>{msg.description}</span>
            </div>
          ))}
        </div>

        {/* Hash (compact) */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Hash className="h-3 w-3" />
          <span className="font-mono truncate">{payloadHash.slice(0, 16)}...</span>
          <CopyButton
            value={payloadHash}
            copyLabel="payload hash"
            className="h-6 w-6"
            showToast={false}
          />
        </div>

        {/* Verification checkbox */}
        {requireVerification && (
          <label className="flex items-start gap-2 cursor-pointer p-2 rounded border hover:bg-muted/50">
            <Checkbox
              checked={verified}
              onCheckedChange={handleVerificationChange}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              I have verified this transaction content
            </span>
          </label>
        )}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Transaction Intent Verification
          </CardTitle>
          <Badge variant={overallRisk === "high" ? "destructive" : "outline"}>
            {signMode.toUpperCase()} mode
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Risk Warning */}
        {overallRisk === "high" && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                High-impact transaction
              </p>
              <p className="text-xs text-muted-foreground">
                This transaction contains operations that may have significant effects.
                Review carefully.
              </p>
            </div>
          </div>
        )}

        {/* Actions Summary */}
        <div>
          <CardLabel comment>Actions ({msgs.length})</CardLabel>
          <div className="space-y-2">
            {messageSummaries.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border",
                  msg.risk === "high" && "border-destructive/30 bg-destructive/5",
                  msg.risk === "medium" && "border-amber-500/30 bg-amber-500/5",
                  msg.risk === "low" && "border-border bg-muted/30",
                )}
              >
                <div className="mt-0.5">{msg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{msg.type}</span>
                    {msg.risk === "high" && (
                      <Badge variant="destructive" className="text-xs">
                        High impact
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {msg.description}
                  </p>
                  {Object.keys(msg.details).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(msg.details).map(([key, value]) => (
                        <div key={key} className="flex text-xs">
                          <span className="text-muted-foreground w-24">{key}:</span>
                          <span className="font-mono text-xs truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <CardLabel comment>Fee</CardLabel>
            <p className="text-sm font-mono">{feeDisplay || "No fee"}</p>
            <p className="text-xs text-muted-foreground">Gas: {fee.gas}</p>
          </div>
          <div>
            <CardLabel comment>Chain</CardLabel>
            <p className="text-sm font-mono">{chainId}</p>
            <p className="text-xs text-muted-foreground">
              Acc: {accountNumber}, Seq: {sequence}
            </p>
          </div>
        </div>

        {/* Memo */}
        {memo && (
          <div>
            <CardLabel comment>Memo</CardLabel>
            <p className="text-sm p-2 rounded bg-muted/50 font-mono break-all">
              {memo}
            </p>
          </div>
        )}

        {/* Payload Hash */}
        <div>
          <CardLabel comment>Payload Hash (for independent verification)</CardLabel>
          <div className="flex items-center gap-2 p-2 rounded bg-muted/50">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <code className="text-xs font-mono flex-1 break-all">{payloadHash}</code>
            <CopyButton
              value={payloadHash}
              copyLabel="payload hash"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Any party can reproduce this hash from the transaction data
          </p>
        </div>

        {/* Raw JSON Toggle */}
        <div>
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            <span>Raw message data</span>
            {showRawJson ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showRawJson && (
            <pre className="mt-2 p-3 rounded bg-muted/50 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(msgs, null, 2)}
            </pre>
          )}
        </div>

        {/* Verification Checkbox */}
        {requireVerification && (
          <div className="border-t pt-4">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border-2 border-dashed hover:border-primary/50 transition-colors">
              <Checkbox
                checked={verified}
                onCheckedChange={handleVerificationChange}
                className="mt-0.5"
              />
              <div>
                <span className="text-sm font-medium">
                  I have verified this transaction
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  I confirm that I have reviewed all actions, the fee, memo, and payload
                  hash, and understand what this transaction will do.
                </p>
              </div>
            </label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseMessage(msg: EncodeObject): MessageSummary {
  const { typeUrl, value } = msg;
  const typeName = typeUrl.split(".").pop() || typeUrl;

  switch (typeUrl) {
    case "/cosmos.bank.v1beta1.MsgSend":
      return {
        type: "Send",
        description: `Send tokens to ${truncateAddress(value.toAddress)}`,
        icon: <SendIcon />,
        details: {
          From: truncateAddress(value.fromAddress),
          To: truncateAddress(value.toAddress),
          Amount: formatCoins(value.amount),
        },
        risk: "low",
      };

    case "/cosmos.staking.v1beta1.MsgDelegate":
      return {
        type: "Delegate",
        description: `Delegate to validator ${truncateAddress(value.validatorAddress)}`,
        icon: <StakeIcon />,
        details: {
          Validator: truncateAddress(value.validatorAddress),
          Amount: formatCoin(value.amount),
        },
        risk: "low",
      };

    case "/cosmos.staking.v1beta1.MsgUndelegate":
      return {
        type: "Undelegate",
        description: `Undelegate from ${truncateAddress(value.validatorAddress)}`,
        icon: <StakeIcon />,
        details: {
          Validator: truncateAddress(value.validatorAddress),
          Amount: formatCoin(value.amount),
        },
        risk: "medium",
      };

    case "/cosmos.staking.v1beta1.MsgBeginRedelegate":
      return {
        type: "Redelegate",
        description: "Move delegation between validators",
        icon: <StakeIcon />,
        details: {
          From: truncateAddress(value.validatorSrcAddress),
          To: truncateAddress(value.validatorDstAddress),
          Amount: formatCoin(value.amount),
        },
        risk: "medium",
      };

    case "/cosmos.gov.v1beta1.MsgVote":
      return {
        type: "Vote",
        description: `Vote on proposal #${value.proposalId}`,
        icon: <VoteIcon />,
        details: {
          Proposal: `#${value.proposalId}`,
          Option: formatVoteOption(value.option),
        },
        risk: "low",
      };

    case "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward":
      return {
        type: "Claim Rewards",
        description: `Claim staking rewards from ${truncateAddress(value.validatorAddress)}`,
        icon: <RewardIcon />,
        details: {
          Validator: truncateAddress(value.validatorAddress),
        },
        risk: "low",
      };

    case "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission":
      return {
        type: "Withdraw Commission",
        description: "Withdraw validator commission",
        icon: <RewardIcon />,
        details: {
          Validator: truncateAddress(value.validatorAddress),
        },
        risk: "low",
      };

    case "/cosmwasm.wasm.v1.MsgExecuteContract":
      return {
        type: "Execute Contract",
        description: `Execute contract ${truncateAddress(value.contract)}`,
        icon: <ContractIcon />,
        details: {
          Contract: truncateAddress(value.contract),
          Funds: formatCoins(value.funds),
        },
        risk: "high",
      };

    case "/cosmwasm.wasm.v1.MsgInstantiateContract":
    case "/cosmwasm.wasm.v1.MsgInstantiateContract2":
      return {
        type: "Instantiate Contract",
        description: "Deploy new contract instance",
        icon: <ContractIcon />,
        details: {
          "Code ID": value.codeId?.toString() || "Unknown",
          Label: value.label || "No label",
        },
        risk: "high",
      };

    case "/cosmwasm.wasm.v1.MsgMigrateContract":
      return {
        type: "Migrate Contract",
        description: `Migrate contract ${truncateAddress(value.contract)}`,
        icon: <ContractIcon />,
        details: {
          Contract: truncateAddress(value.contract),
          "New Code ID": value.codeId?.toString() || "Unknown",
        },
        risk: "high",
      };

    case "/ibc.applications.transfer.v1.MsgTransfer":
      return {
        type: "IBC Transfer",
        description: `Transfer via IBC to ${truncateAddress(value.receiver)}`,
        icon: <IBCIcon />,
        details: {
          Receiver: truncateAddress(value.receiver),
          Channel: value.sourceChannel,
          Amount: formatCoin(value.token),
        },
        risk: "medium",
      };

    default:
      return {
        type: typeName.replace("Msg", ""),
        description: `Execute ${typeName}`,
        icon: <FileText className="h-4 w-4 text-muted-foreground" />,
        details: {},
        risk: "medium",
      };
  }
}

function truncateAddress(address?: string): string {
  if (!address) return "Unknown";
  if (address.length <= 20) return address;
  return `${address.slice(0, 12)}...${address.slice(-6)}`;
}

function formatAmount(amount: string): string {
  const num = parseInt(amount, 10);
  if (isNaN(num)) return amount;
  // Format with thousand separators
  return num.toLocaleString();
}

function formatCoin(coin?: { amount: string; denom: string }): string {
  if (!coin) return "None";
  return `${formatAmount(coin.amount)} ${coin.denom}`;
}

function formatCoins(coins?: { amount: string; denom: string }[]): string {
  if (!coins || coins.length === 0) return "None";
  return coins.map((c) => formatCoin(c)).join(", ");
}

function formatVoteOption(option: number | string): string {
  const options: Record<number | string, string> = {
    0: "Unspecified",
    1: "Yes",
    2: "Abstain",
    3: "No",
    4: "No with Veto",
    VOTE_OPTION_YES: "Yes",
    VOTE_OPTION_ABSTAIN: "Abstain",
    VOTE_OPTION_NO: "No",
    VOTE_OPTION_NO_WITH_VETO: "No with Veto",
  };
  return options[option] || String(option);
}

// ============================================================================
// Icons
// ============================================================================

function SendIcon() {
  return (
    <svg
      className="h-4 w-4 text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function StakeIcon() {
  return (
    <svg
      className="h-4 w-4 text-green-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function VoteIcon() {
  return (
    <svg
      className="h-4 w-4 text-purple-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function RewardIcon() {
  return (
    <svg
      className="h-4 w-4 text-amber-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ContractIcon() {
  return (
    <svg
      className="h-4 w-4 text-red-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function IBCIcon() {
  return (
    <svg
      className="h-4 w-4 text-cyan-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

export default ProposalIntentView;

