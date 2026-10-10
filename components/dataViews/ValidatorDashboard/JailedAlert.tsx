/**
 * Jailed Alert
 *
 * Full-width alert at the very top of the validator dashboard while the validator is jailed.
 * It hosts the Unjail action (UnjailAction), which renders nothing unless the validator is
 * jailed. Until 2026-10-10 this block sat at the bottom of the identity card.
 */

import { AlertTriangle } from "lucide-react";
import { ValidatorInfo, ValidatorSigningInfo } from "@/lib/validatorHelpers";
import UnjailAction from "./UnjailAction";

interface JailedAlertProps {
  validator: ValidatorInfo;
  /** Chain signing info, only fetched while jailed; null = unavailable */
  signingInfo?: ValidatorSigningInfo | null;
  onTransactionComplete?: () => void;
  isCliqMode?: boolean;
  cliqAddress?: string;
  readOnly?: boolean;
}

export default function JailedAlert({
  validator,
  signingInfo = null,
  onTransactionComplete,
  isCliqMode = false,
  cliqAddress,
  readOnly = false,
}: JailedAlertProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-destructive">Validator jailed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your validator has been jailed. You can still claim pending rewards.
          </p>
          <UnjailAction
            validator={validator}
            signingInfo={signingInfo}
            onTransactionComplete={onTransactionComplete}
            isCliqMode={isCliqMode}
            cliqAddress={cliqAddress}
            readOnly={readOnly}
          />
        </div>
      </div>
    </div>
  );
}
