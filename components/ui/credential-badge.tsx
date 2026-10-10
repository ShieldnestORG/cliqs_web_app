/**
 * Credential Status Badge
 * 
 * Visual indicator for credential status in the multisig UI.
 * Shows whether a user holds a valid credential for a team.
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import { Badge, type BadgeMark } from "@/components/ui/badge";
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
    variant: "success" | "warning" | "destructive" | "secondary";
    mark?: BadgeMark;
  }
> = {
  valid: {
    icon: CheckCircle2,
    label: "Verified",
    description: "You hold a valid credential for this team",
    variant: "success",
    mark: "signal",
  },
  missing: {
    icon: XCircle,
    label: "No Credential",
    description: "You do not have a credential for this team",
    variant: "destructive",
    mark: "stripes",
  },
  expired: {
    icon: Clock,
    label: "Expired",
    description: "Your credential has expired",
    variant: "warning",
    mark: "ring",
  },
  frozen: {
    icon: Pause,
    label: "Frozen",
    description: "Your credential is frozen and cannot be used",
    variant: "warning",
    mark: "stripes",
  },
  revoked: {
    icon: XCircle,
    label: "Revoked",
    description: "Your credential has been revoked",
    variant: "destructive",
    mark: "stripes",
  },
  wrong_role: {
    icon: AlertTriangle,
    label: "Wrong Role",
    description: "Your credential does not have the required role",
    variant: "warning",
    mark: "stripes",
  },
  loading: {
    icon: Loader2,
    label: "Checking...",
    description: "Verifying credential status",
    variant: "secondary",
    mark: "half",
  },
  not_required: {
    icon: Shield,
    label: "Not Required",
    description: "This team does not require credentials",
    variant: "secondary",
  },
};

// ============================================================================
// Component
// ============================================================================

export function CredentialBadge({
  status,
  role,
  className,
  showTooltip = true,
  tooltipMessage,
}: CredentialBadgeProps) {
  const config = statusConfig[status];

  const badge = (
    <Badge variant={config.variant} mark={config.mark} className={className}>
      {config.label}
      {role && status === "valid" && ` (${role})`}
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
    valid: "text-success",
    missing: "text-destructive",
    expired: "text-warning",
    frozen: "text-warning",
    revoked: "text-destructive",
    wrong_role: "text-warning",
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

