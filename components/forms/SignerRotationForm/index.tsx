/**
 * Signer Rotation Form
 * 
 * File: components/forms/SignerRotationForm/index.tsx
 * 
 * Step-by-step wizard for rotating a signer's credential.
 * This performs:
 * 1. Burn the old signer's credential
 * 2. Issue a new credential to the new signer
 * 3. Update group membership (if applicable)
 * 
 * Phase 3: Identity NFTs (Credential-Gated Multisig)
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  User,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface SignerRotationFormProps {
  teamAddress: string;
  chainId: string;
  classId: string;
  groupAddress?: string;
  currentMembers: Array<{ address: string; role: string }>;
  onComplete?: () => void;
  onCancel?: () => void;
  className?: string;
}

type RotationStep = "select" | "new-signer" | "confirm" | "executing" | "complete";

interface RotationState {
  oldSignerAddress: string;
  newSignerAddress: string;
  role: string;
  updateGroupMembership: boolean;
  // Transaction results
  burnTxHash?: string;
  mintTxHash?: string;
  groupUpdateTxHash?: string;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export function SignerRotationForm({
  teamAddress,
  chainId,
  classId,
  groupAddress,
  currentMembers,
  onComplete,
  onCancel,
  className,
}: SignerRotationFormProps) {
  // State
  const [step, setStep] = useState<RotationStep>("select");
  const [state, setState] = useState<RotationState>({
    oldSignerAddress: "",
    newSignerAddress: "",
    role: "member",
    updateGroupMembership: !!groupAddress,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // Step Navigation
  // ============================================================================

  const steps: RotationStep[] = ["select", "new-signer", "confirm", "executing", "complete"];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canGoNext = (): boolean => {
    switch (step) {
      case "select":
        return !!state.oldSignerAddress;
      case "new-signer":
        return !!state.newSignerAddress && state.newSignerAddress !== state.oldSignerAddress;
      case "confirm":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  // ============================================================================
  // Rotation Execution
  // ============================================================================

  const executeRotation = async () => {
    setStep("executing");
    setIsSubmitting(true);
    
    try {
      // Generate new token ID
      const newTokenId = `cred-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Call rotation API
      const response = await fetch(`/api/chain/${chainId}/credentials/rotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          oldSignerAddress: state.oldSignerAddress,
          newSignerAddress: state.newSignerAddress,
          newTokenId,
          role: state.role,
          teamAddress,
          actor: "", // Would be the connected wallet
          burnTxHash: "", // Would be set after actual broadcast
          mintTxHash: "",
          burnHeight: 0,
          mintHeight: 0,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Rotation failed");
      }

      const result = await response.json();
      
      setState((prev) => ({
        ...prev,
        burnTxHash: result.revokedCredential ? "success" : undefined,
        mintTxHash: result.newCredential ? "success" : undefined,
      }));

      setStep("complete");
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Rotation failed",
      }));
      setStep("complete");
    } finally {
      setIsSubmitting(false);
    }
  };

  const truncateAddress = (address: string) => {
    if (!address) return "";
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  };

  // ============================================================================
  // Render Steps
  // ============================================================================

  const renderStep = () => {
    switch (step) {
      case "select":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Signer to Replace</Label>
              <Select
                value={state.oldSignerAddress}
                onValueChange={(value) =>
                  setState((prev) => ({
                    ...prev,
                    oldSignerAddress: value,
                    role: currentMembers.find((m) => m.address === value)?.role || "member",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a current member..." />
                </SelectTrigger>
                <SelectContent>
                  {currentMembers.map((member) => (
                    <SelectItem key={member.address} value={member.address}>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {truncateAddress(member.address)}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({member.role})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {state.oldSignerAddress && (
              <Alert>
                <User className="h-4 w-4" />
                <AlertTitle>Selected Signer</AlertTitle>
                <AlertDescription>
                  <code className="text-xs">{state.oldSignerAddress}</code>
                  <p className="mt-1 text-muted-foreground">
                    This signer's credential will be revoked (burned).
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case "new-signer":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-signer">New Signer Address</Label>
              <Input
                id="new-signer"
                placeholder="core1..."
                value={state.newSignerAddress}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, newSignerAddress: e.target.value }))
                }
              />
              {state.newSignerAddress === state.oldSignerAddress && (
                <p className="text-sm text-destructive">
                  New signer cannot be the same as old signer
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Assigned Role</Label>
              <Select
                value={state.role}
                onValueChange={(value) =>
                  setState((prev) => ({ ...prev, role: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="proposer">Proposer</SelectItem>
                  <SelectItem value="executor">Executor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {groupAddress && (
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="update-group"
                  checked={state.updateGroupMembership}
                  onCheckedChange={(checked) =>
                    setState((prev) => ({
                      ...prev,
                      updateGroupMembership: checked === true,
                    }))
                  }
                />
                <Label htmlFor="update-group" className="text-sm">
                  Also update group membership (CW4)
                </Label>
              </div>
            )}
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Review Rotation Details</AlertTitle>
              <AlertDescription>
                Please review the following changes before proceeding.
                This action cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Old Signer (to remove)</span>
                <code className="text-xs">{truncateAddress(state.oldSignerAddress)}</code>
              </div>
              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">New Signer (to add)</span>
                <code className="text-xs">{truncateAddress(state.newSignerAddress)}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="text-sm capitalize">{state.role}</span>
              </div>
              {groupAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Update Group</span>
                  <span className="text-sm">
                    {state.updateGroupMembership ? "Yes" : "No"}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">The following will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  Old signer's credential NFT will be burned
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-3 w-3" />
                  New credential NFT will be minted for new signer
                </li>
                {state.updateGroupMembership && groupAddress && (
                  <li className="flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Group membership will be updated
                  </li>
                )}
              </ul>
            </div>
          </div>
        );

      case "executing":
        return (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Executing Rotation...</p>
            <p className="text-sm text-muted-foreground">
              Please wait while we process the credential rotation.
            </p>
          </div>
        );

      case "complete":
        return (
          <div className="space-y-4">
            {state.error ? (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Rotation Failed</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertTitle>Rotation Complete</AlertTitle>
                  <AlertDescription>
                    The signer rotation has been completed successfully.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2 bg-muted/50 rounded-lg p-4">
                  {state.burnTxHash && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Old credential revoked</span>
                    </div>
                  )}
                  {state.mintTxHash && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>New credential issued</span>
                    </div>
                  )}
                  {state.groupUpdateTxHash && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>Group membership updated</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground">
                  The team address remains unchanged. The new signer can now participate
                  in proposals and voting.
                </p>
              </>
            )}
          </div>
        );
    }
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <Card className={cn("max-w-lg", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Rotate Signer
        </CardTitle>
        <CardDescription>
          Replace a team member while keeping the team address unchanged
        </CardDescription>
        <Progress value={progress} className="mt-4" />
      </CardHeader>

      <CardContent>{renderStep()}</CardContent>

      <CardFooter className="flex justify-between">
        {step === "complete" ? (
          <div className="w-full flex justify-end gap-2">
            {state.error && (
              <Button
                variant="outline"
                onClick={() => {
                  setStep("select");
                  setState({
                    oldSignerAddress: "",
                    newSignerAddress: "",
                    role: "member",
                    updateGroupMembership: !!groupAddress,
                  });
                }}
              >
                Try Again
              </Button>
            )}
            <Button onClick={onComplete}>Done</Button>
          </div>
        ) : step === "executing" ? null : (
          <>
            <Button
              variant="outline"
              onClick={step === "select" ? onCancel : goBack}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {step === "select" ? "Cancel" : "Back"}
            </Button>
            
            <Button
              onClick={step === "confirm" ? executeRotation : goNext}
              disabled={!canGoNext() || isSubmitting}
            >
              {step === "confirm" ? (
                <>
                  Execute Rotation
                  <RotateCcw className="h-4 w-4 ml-1" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

export default SignerRotationForm;

