/**
 * Emergency Panel Component
 * 
 * File: components/emergency/EmergencyPanel.tsx
 * 
 * Displays emergency controls for pause/unpause and safe mode activation.
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

"use client";

import { useState } from "react";
import { AlertTriangle, Pause, Play, Shield, ShieldAlert } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { EmergencyState } from "@/lib/emergency/types";

// ============================================================================
// Types
// ============================================================================

interface EmergencyPanelProps {
  multisigAddress: string;
  chainId: string;
  state: EmergencyState;
  normalThreshold: number;
  totalWeight: number;
  onPause: (reason: string, durationSeconds?: number) => Promise<void>;
  onUnpause: () => Promise<void>;
  onActivateSafeMode: (threshold: number) => Promise<void>;
  onDeactivateSafeMode: () => Promise<void>;
  canPause: boolean;
  canUnpause: boolean;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function EmergencyPanel({
  multisigAddress,
  chainId,
  state,
  normalThreshold,
  totalWeight,
  onPause,
  onUnpause,
  onActivateSafeMode,
  onDeactivateSafeMode,
  canPause,
  canUnpause,
  isLoading = false,
}: EmergencyPanelProps) {
  const [pauseReason, setPauseReason] = useState("");
  const [pauseDuration, setPauseDuration] = useState<number | undefined>(undefined);
  const [safeModeThreshold, setSafeModeThreshold] = useState(normalThreshold + 1);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isSafeModeDialogOpen, setIsSafeModeDialogOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handlePause = async () => {
    if (!pauseReason.trim()) return;
    
    setIsActionLoading(true);
    try {
      await onPause(pauseReason, pauseDuration);
      setIsPauseDialogOpen(false);
      setPauseReason("");
      setPauseDuration(undefined);
    } catch (error) {
      console.error("Failed to pause:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnpause = async () => {
    setIsActionLoading(true);
    try {
      await onUnpause();
    } catch (error) {
      console.error("Failed to unpause:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleActivateSafeMode = async () => {
    setIsActionLoading(true);
    try {
      await onActivateSafeMode(safeModeThreshold);
      setIsSafeModeDialogOpen(false);
    } catch (error) {
      console.error("Failed to activate safe mode:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeactivateSafeMode = async () => {
    setIsActionLoading(true);
    try {
      await onDeactivateSafeMode();
    } catch (error) {
      console.error("Failed to deactivate safe mode:", error);
    } finally {
      setIsActionLoading(false);
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Status Alert */}
      {(state.isPaused || state.isSafeMode) && (
        <Alert variant={state.isPaused ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {state.isPaused ? "Operations Paused" : "Safe Mode Active"}
          </AlertTitle>
          <AlertDescription>
            {state.isPaused && (
              <>
                Operations were paused by {state.pausedBy?.slice(0, 12)}... at{" "}
                {formatTimestamp(state.pausedAt)}
                {state.pauseReason && <> - Reason: {state.pauseReason}</>}
                {state.autoUnpauseAt && (
                  <> - Auto-unpause at {formatTimestamp(state.autoUnpauseAt)}</>
                )}
              </>
            )}
            {!state.isPaused && state.isSafeMode && (
              <>
                Safe mode is active with elevated threshold of{" "}
                {state.safeModeThreshold} (normal: {normalThreshold})
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Pause Control Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state.isPaused ? (
              <Pause className="h-5 w-5 text-destructive" />
            ) : (
              <Play className="h-5 w-5 text-green-accent" />
            )}
            Pause Control
          </CardTitle>
          <CardDescription>
            Pause or resume all multisig operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground">Current Status</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={state.isPaused ? "destructive" : "secondary"}>
                  {state.isPaused ? "PAUSED" : "OPERATIONAL"}
                </Badge>
                {state.isPaused && state.autoUnpauseAt && (
                  <span className="text-xs text-muted-foreground">
                    Auto-unpause: {formatTimestamp(state.autoUnpauseAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {state.isPaused ? (
            <Button
              variant="default"
              onClick={handleUnpause}
              disabled={!canUnpause || isLoading || isActionLoading}
            >
              <Play className="h-4 w-4 mr-2" />
              Resume Operations
            </Button>
          ) : (
            <Dialog open={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!canPause || isLoading || isActionLoading}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause Operations
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Pause Multisig Operations</DialogTitle>
                  <DialogDescription>
                    This will block all new approvals and executions.
                    Queries will still work. Credential checks remain enforced.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="pauseReason">Reason for pause *</Label>
                    <Input
                      id="pauseReason"
                      value={pauseReason}
                      onChange={(e) => setPauseReason(e.target.value)}
                      placeholder="e.g., Suspected compromise, scheduled maintenance"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pauseDuration">Duration (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="pauseDuration"
                        type="number"
                        value={pauseDuration || ""}
                        onChange={(e) => setPauseDuration(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="Duration"
                        className="flex-1"
                      />
                      <select
                        className="px-3 py-2 border rounded-md"
                        onChange={(e) => {
                          if (pauseDuration) {
                            const multiplier = parseInt(e.target.value);
                            setPauseDuration(pauseDuration * multiplier);
                          }
                        }}
                      >
                        <option value="1">seconds</option>
                        <option value="60">minutes</option>
                        <option value="3600">hours</option>
                        <option value="86400">days</option>
                      </select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leave empty for indefinite pause (manual unpause required)
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPauseDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handlePause}
                    disabled={!pauseReason.trim() || isActionLoading}
                  >
                    {isActionLoading ? "Pausing..." : "Pause Now"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      </Card>

      {/* Safe Mode Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {state.isSafeMode ? (
              <ShieldAlert className="h-5 w-5 text-amber-500" />
            ) : (
              <Shield className="h-5 w-5 text-green-accent" />
            )}
            Safe Mode
          </CardTitle>
          <CardDescription>
            Temporarily elevate threshold without contract redeployment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Normal Threshold</div>
              <div className="text-2xl font-bold">
                {normalThreshold} / {totalWeight}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Current Threshold</div>
              <div className="text-2xl font-bold">
                {state.isSafeMode ? state.safeModeThreshold : normalThreshold} / {totalWeight}
                {state.isSafeMode && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    ELEVATED
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          {state.isSafeMode ? (
            <Button
              variant="default"
              onClick={handleDeactivateSafeMode}
              disabled={isLoading || isActionLoading}
            >
              <Shield className="h-4 w-4 mr-2" />
              Deactivate Safe Mode
            </Button>
          ) : (
            <Dialog open={isSafeModeDialogOpen} onOpenChange={setIsSafeModeDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={state.isPaused || isLoading || isActionLoading}
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Activate Safe Mode
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Activate Safe Mode</DialogTitle>
                  <DialogDescription>
                    Temporarily require a higher threshold for all operations.
                    This is useful during uncertain conditions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="safeModeThreshold">Elevated Threshold</Label>
                    <Input
                      id="safeModeThreshold"
                      type="number"
                      min={normalThreshold + 1}
                      max={totalWeight}
                      value={safeModeThreshold}
                      onChange={(e) => setSafeModeThreshold(parseInt(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be higher than normal threshold ({normalThreshold}) and at most {totalWeight}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSafeModeDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleActivateSafeMode}
                    disabled={safeModeThreshold <= normalThreshold || safeModeThreshold > totalWeight || isActionLoading}
                  >
                    {isActionLoading ? "Activating..." : "Activate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      </Card>

      {/* Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permissions</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Can Pause:</span>
            <Badge variant={canPause ? "default" : "secondary"}>
              {canPause ? "Yes" : "No"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Can Unpause:</span>
            <Badge variant={canUnpause ? "default" : "secondary"}>
              {canUnpause ? "Yes" : "No"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Unpause requires higher threshold (N+1) or timelocked admin action.
            Emergency controls do NOT bypass credential checks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmergencyPanel;

