/**
 * Policy Manager Component
 * 
 * File: components/policies/PolicyManager.tsx
 * 
 * Displays and manages policies for a multisig.
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

"use client";

import { useState } from "react";
import {
  Clock,
  DollarSign,
  Filter,
  MessageSquare,
  Plus,
  Settings,
  Shield,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PolicyType, StoredPolicy } from "@/lib/policies/types";

// ============================================================================
// Types
// ============================================================================

interface PolicyManagerProps {
  multisigAddress: string;
  chainId: string;
  policies: StoredPolicy[];
  onCreatePolicy: (type: PolicyType) => void;
  onEditPolicy: (policy: StoredPolicy) => void;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onTogglePolicy: (policyId: string, enabled: boolean) => Promise<void>;
  isLoading?: boolean;
}

// ============================================================================
// Policy Type Icons
// ============================================================================

const policyIcons: Record<PolicyType, React.ElementType> = {
  timelock: Clock,
  emergency: Shield,
  msg_type: MessageSquare,
  spend_limit: DollarSign,
  allowlist: Filter,
  denylist: Filter,
  custom: Settings,
};

const policyDescriptions: Record<PolicyType, string> = {
  timelock: "Enforces minimum delay between approval and execution",
  emergency: "Controls pause and safe mode behavior",
  msg_type: "Restricts or requires approval for specific message types",
  spend_limit: "Limits spending per transaction and daily",
  allowlist: "Only allows transactions to specific addresses",
  denylist: "Blocks transactions to specific addresses",
  custom: "Custom policy with user-defined rules",
};

const policyPriorities: Record<PolicyType, number> = {
  timelock: 1,
  emergency: 2,
  msg_type: 3,
  spend_limit: 4,
  allowlist: 5,
  denylist: 5,
  custom: 6,
};

// ============================================================================
// Component
// ============================================================================

export function PolicyManager({
  multisigAddress,
  chainId,
  policies,
  onCreatePolicy,
  onEditPolicy,
  onDeletePolicy,
  onTogglePolicy,
  isLoading = false,
}: PolicyManagerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleDelete = async (policyId: string) => {
    setDeletingId(policyId);
    try {
      await onDeletePolicy(policyId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (policyId: string, enabled: boolean) => {
    setTogglingId(policyId);
    try {
      await onTogglePolicy(policyId, enabled);
    } finally {
      setTogglingId(null);
    }
  };

  // ============================================================================
  // Sorting and Grouping
  // ============================================================================

  const sortedPolicies = [...policies].sort(
    (a, b) => a.priority - b.priority
  );

  const enabledCount = policies.filter((p) => p.enabled).length;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Policies</h2>
          <p className="text-muted-foreground">
            {enabledCount} of {policies.length} policies active
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={isLoading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Policy
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {(Object.keys(policyDescriptions) as PolicyType[]).map((type) => {
              const Icon = policyIcons[type];
              return (
                <DropdownMenuItem
                  key={type}
                  onClick={() => onCreatePolicy(type)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize">{type.replace("_", " ")}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    P{policyPriorities[type]}
                  </Badge>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Policy List */}
      {sortedPolicies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No policies configured</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Policies provide additional security by enforcing rules on proposals
              and executions. Add your first policy to get started.
            </p>
            <Button onClick={() => onCreatePolicy("timelock")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Timelock Policy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedPolicies.map((policy) => {
            const Icon = policyIcons[policy.type] || Settings;
            const isDeleting = deletingId === policy.id;
            const isToggling = togglingId === policy.id;

            return (
              <Card key={policy.id} className={!policy.enabled ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${policy.enabled ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`h-5 w-5 ${policy.enabled ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{policy.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {policyDescriptions[policy.type]}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Priority {policy.priority}
                      </Badge>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={(enabled) => handleToggle(policy.id, enabled)}
                        disabled={isLoading || isToggling}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <PolicyConfigSummary policy={policy} />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(policy.updatedAt).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditPolicy(policy)}
                      disabled={isLoading}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={isLoading || isDeleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete Policy</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete &quot;{policy.name}&quot;? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline">Cancel</Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleDelete(policy.id)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Policy Priority Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Policy Priority Order</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>Timelock</strong> - Risk containment window (must come before spend limits)</li>
            <li><strong>Emergency</strong> - Kill switch for operations</li>
            <li><strong>Message Type</strong> - Controls attack surface</li>
            <li><strong>Spend Limits</strong> - Value controls (only safe after timelock)</li>
            <li><strong>Allowlist/Denylist</strong> - Recipient filtering</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Policy Config Summary
// ============================================================================

function PolicyConfigSummary({ policy }: { policy: StoredPolicy }) {
  try {
    const config = JSON.parse(policy.configJSON);
    
    switch (policy.type) {
      case "timelock":
        return (
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Min Delay: </span>
              <span>{formatDuration(config.minDelaySeconds)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Max Delay: </span>
              <span>{formatDuration(config.maxDelaySeconds)}</span>
            </div>
            {config.highValueMultiplier > 1 && (
              <div>
                <span className="text-muted-foreground">High Value: </span>
                <span>{config.highValueMultiplier}x</span>
              </div>
            )}
          </div>
        );
        
      case "spend_limit":
        return (
          <div className="text-sm">
            {config.perTxLimits?.map((limit: { denom: string; amount: string }) => (
              <span key={limit.denom} className="mr-4">
                <span className="text-muted-foreground">Per-tx: </span>
                <span>{formatAmount(limit)}</span>
              </span>
            ))}
            {config.dailyLimits?.map((limit: { denom: string; amount: string }) => (
              <span key={limit.denom} className="mr-4">
                <span className="text-muted-foreground">Daily: </span>
                <span>{formatAmount(limit)}</span>
              </span>
            ))}
          </div>
        );
        
      case "msg_type":
        return (
          <div className="text-sm">
            {config.blockedMsgTypes?.length > 0 && (
              <span className="mr-4">
                <span className="text-muted-foreground">Blocked: </span>
                <span>{config.blockedMsgTypes.length} types</span>
              </span>
            )}
            {config.allowedMsgTypes?.length > 0 && (
              <span>
                <span className="text-muted-foreground">Allowed: </span>
                <span>{config.allowedMsgTypes.length} types</span>
              </span>
            )}
          </div>
        );
        
      case "allowlist":
      case "denylist":
        return (
          <div className="text-sm">
            <span className="text-muted-foreground">
              {policy.type === "allowlist" ? "Allowed: " : "Blocked: "}
            </span>
            <span>
              {(config.allowlist?.length || 0) + (config.denylist?.length || 0)} addresses
            </span>
          </div>
        );
        
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatAmount(coin: { denom: string; amount: string }): string {
  const amount = BigInt(coin.amount);
  const denomDisplay = coin.denom.startsWith("u") 
    ? coin.denom.slice(1).toUpperCase()
    : coin.denom;
  
  // Convert from micro units if applicable
  if (coin.denom.startsWith("u")) {
    const major = Number(amount) / 1_000_000;
    return `${major.toLocaleString()} ${denomDisplay}`;
  }
  
  return `${amount.toLocaleString()} ${denomDisplay}`;
}

export default PolicyManager;

