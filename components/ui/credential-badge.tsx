/**
 * Credential Status Badge
 * 
 * File: components/ui/credential-badge.tsx
 * 
 * Visual indicator for credential status in the multisig UI.
 * Shows whether a user holds a valid credential for a team.
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Pause,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type CredentialStatusType =
  | "valid"
  | "missing"
  | "expired"
  | "frozen"
  | "revoked"
  | "wrong_role"
  | "loading"
  | "not_required";

export interface CredentialBadgeProps {
  /** Current credential status */
  status: CredentialStatusType;
  /** Role if credential is valid */
  role?: string;
  /** Show as compact badge */
  compact?: boolean;
  /** Additional class names */
  className?: string;
  /** Show tooltip with details */
  showTooltip?: boolean;
  /** Custom tooltip message */
  tooltipMessage?: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

const statusConfig: Record<
  CredentialStatusType,
  {
    icon: typeof CheckCircle2;
    label: string;
    description: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
  }
> = {
  valid: {
    icon: CheckCircle2,
    label: "Verified",
    description: "You hold a valid credential for this team",
    variant: "default",
    className: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/30",
  },
  missing: {
    icon: XCircle,
    label: "No Credential",
    description: "You do not have a credential for this team",
    variant: "destructive",
    className: "bg-red-500/20 text-red-500 border-red-500/30",
  },
  expired: {
    icon: Clock,
    label: "Expired",
    description: "Your credential has expired",
    variant: "secondary",
    className: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  },
  frozen: {
    icon: Pause,
    label: "Frozen",
    description: "Your credential is frozen and cannot be used",
    variant: "secondary",
    className: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  },
  revoked: {
    icon: XCircle,
    label: "Revoked",
    description: "Your credential has been revoked",
    variant: "destructive",
    className: "bg-red-500/20 text-red-500 border-red-500/30",
  },
  wrong_role: {
    icon: AlertTriangle,
    label: "Wrong Role",
    description: "Your credential does not have the required role",
    variant: "secondary",
    className: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  },
  loading: {
    icon: Loader2,
    label: "Checking...",
    description: "Verifying credential status",
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground",
  },
  not_required: {
    icon: Shield,
    label: "Not Required",
    description: "This team does not require credentials",
    variant: "outline",
    className: "bg-muted/50 text-muted-foreground",
  },
};

// ============================================================================
// Component
// ============================================================================

export function CredentialBadge({
  status,
  role,
  compact = false,
  className,
  showTooltip = true,
  tooltipMessage,
}: CredentialBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1 font-medium",
        config.className,
        compact && "px-1.5 py-0.5",
        className,
      )}
    >
      <Icon
        className={cn(
          "shrink-0",
          compact ? "h-3 w-3" : "h-3.5 w-3.5",
          status === "loading" && "animate-spin",
        )}
      />
      {!compact && (
        <span className="text-xs">
          {config.label}
          {role && status === "valid" && ` (${role})`}
        </span>
      )}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">
            {tooltipMessage || config.description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// Credential Icon (for inline use)
// ============================================================================

export interface CredentialIconProps {
  status: CredentialStatusType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function CredentialIcon({ status, size = "md", className }: CredentialIconProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const colorClasses: Record<CredentialStatusType, string> = {
    valid: "text-emerald-500",
    missing: "text-red-500",
    expired: "text-amber-500",
    frozen: "text-orange-500",
    revoked: "text-red-500",
    wrong_role: "text-amber-500",
    loading: "text-muted-foreground",
    not_required: "text-muted-foreground",
  };

  return (
    <Icon
      className={cn(
        sizeClasses[size],
        colorClasses[status],
        status === "loading" && "animate-spin",
        className,
      )}
    />
  );
}

// ============================================================================
// Helper Hook for Credential Status
// ============================================================================

export function mapVerificationResultToStatus(
  result: { isValid: boolean; reason?: string } | null | undefined,
  isLoading: boolean,
  isCredentialGated: boolean,
): CredentialStatusType {
  if (!isCredentialGated) {
    return "not_required";
  }

  if (isLoading) {
    return "loading";
  }

  if (!result) {
    return "missing";
  }

  if (result.isValid) {
    return "valid";
  }

  // Map reason to status
  switch (result.reason) {
    case "not_found":
    case "no_credential_class":
      return "missing";
    case "expired":
      return "expired";
    case "frozen":
      return "frozen";
    case "revoked":
      return "revoked";
    case "wrong_role":
      return "wrong_role";
    default:
      return "missing";
  }
}

