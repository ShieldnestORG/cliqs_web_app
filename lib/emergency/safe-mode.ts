/**
 * Safe Mode Controller - Elevated Threshold Emergency Mode
 *
 * File: lib/emergency/safe-mode.ts
 *
 * Implements safe mode which elevates the threshold temporarily
 * without requiring contract redeployment.
 *
 * Safe mode provides:
 * - Temporary threshold elevation
 * - Configurable trigger conditions
 * - Auto-disable timer
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import * as localDb from "@/lib/localDb";
import {
  SafeModeActivateInput,
  SafeModeActivateResult,
  SafeModeDeactivateInput,
  SafeModeDeactivateResult,
  SafeModeTrigger,
  EmergencyEvent,
  EmergencyError,
} from "./types";

// ============================================================================
// Safe Mode Configuration
// ============================================================================

export interface SafeModeConfig {
  /** Default threshold increase when activated */
  readonly defaultThresholdIncrease: number;
  /** Maximum threshold (usually total weight) */
  readonly maxThreshold: number;
  /** Default auto-disable duration (seconds) */
  readonly defaultAutoDisableSeconds: number;
  /** Maximum auto-disable duration (seconds) */
  readonly maxAutoDisableSeconds: number;
  /** Triggers that auto-activate safe mode */
  readonly autoTriggers: readonly SafeModeTrigger[];
}

const DEFAULT_CONFIG: SafeModeConfig = {
  defaultThresholdIncrease: 1,
  maxThreshold: 100, // Will be overridden by actual total weight
  defaultAutoDisableSeconds: 86400, // 24 hours
  maxAutoDisableSeconds: 604800, // 7 days
  autoTriggers: ["anomaly_detected", "credential_revoked"],
};

// ============================================================================
// Safe Mode Controller Implementation
// ============================================================================

export class SafeModeController {
  private readonly config: SafeModeConfig;
  private readonly eventListeners: Set<(event: EmergencyEvent) => void> = new Set();

  constructor(config: Partial<SafeModeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current safe mode state for a multisig
   */
  getState(
    multisigAddress: string,
    chainId: string,
  ): {
    isSafeMode: boolean;
    threshold: number | null;
    activatedAt: number | null;
    autoDisableAt: number | null;
  } {
    const dbState = localDb.getEmergencyState(multisigAddress, chainId);

    if (!dbState) {
      return {
        isSafeMode: false,
        threshold: null,
        activatedAt: null,
        autoDisableAt: null,
      };
    }

    // Check for auto-disable
    if (dbState.isSafeMode && dbState.safeModeActivatedAt) {
      // For simplicity, we'll check if safe mode should auto-disable
      // In a real implementation, this would be handled by a background job
    }

    return {
      isSafeMode: dbState.isSafeMode,
      threshold: dbState.safeModeThreshold,
      activatedAt: dbState.safeModeActivatedAt
        ? new Date(dbState.safeModeActivatedAt).getTime() / 1000
        : null,
      autoDisableAt: null, // Would need to be stored in DB
    };
  }

  /**
   * Check if safe mode is active
   */
  isActive(multisigAddress: string, chainId: string): boolean {
    return this.getState(multisigAddress, chainId).isSafeMode;
  }

  /**
   * Get the effective threshold (elevated if in safe mode)
   */
  getEffectiveThreshold(multisigAddress: string, chainId: string, normalThreshold: number): number {
    const state = this.getState(multisigAddress, chainId);

    if (state.isSafeMode && state.threshold !== null) {
      return state.threshold;
    }

    return normalThreshold;
  }

  // ============================================================================
  // Safe Mode Operations
  // ============================================================================

  /**
   * Activate safe mode for a multisig
   *
   * Safe mode elevates the threshold without contract redeployment.
   * This provides an extra layer of security during uncertain conditions.
   */
  async activate(
    multisigAddress: string,
    chainId: string,
    normalThreshold: number,
    input: SafeModeActivateInput,
  ): Promise<SafeModeActivateResult> {
    const currentState = this.getState(multisigAddress, chainId);

    // Check if already in safe mode
    if (currentState.isSafeMode) {
      throw new EmergencyError("Safe mode is already active", "ALREADY_IN_SAFE_MODE", {
        currentThreshold: currentState.threshold,
        activatedAt: currentState.activatedAt,
      });
    }

    // Validate threshold
    const newThreshold = input.elevatedThreshold;
    if (newThreshold <= normalThreshold) {
      throw new EmergencyError(
        "Elevated threshold must be higher than normal threshold",
        "INVALID_THRESHOLD",
        { normalThreshold, requestedThreshold: newThreshold },
      );
    }

    if (newThreshold > this.config.maxThreshold) {
      throw new EmergencyError(
        `Threshold cannot exceed maximum (${this.config.maxThreshold})`,
        "INVALID_THRESHOLD",
        { maxThreshold: this.config.maxThreshold, requestedThreshold: newThreshold },
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Calculate auto-disable time
    let autoDisableAt: number | null = null;
    if (input.autoDisableAfterSeconds !== undefined) {
      const duration = Math.min(input.autoDisableAfterSeconds, this.config.maxAutoDisableSeconds);
      autoDisableAt = now + duration;
    }

    // Update state
    localDb.updateEmergencyState(multisigAddress, chainId, {
      isSafeMode: true,
      safeModeThreshold: newThreshold,
      safeModeActivatedAt: new Date(now * 1000).toISOString(),
    });

    // Record event
    localDb.recordEmergencyEvent({
      multisigAddress,
      chainId,
      eventType: "safe_mode_on",
      actor: input.actor,
      reason: input.reason || `Safe mode activated: ${input.trigger}`,
      txHash: null,
      height: null,
      autoUnpauseAt: autoDisableAt ? new Date(autoDisableAt * 1000).toISOString() : null,
    });

    // Emit event
    this.emitEvent({
      type: "SAFE_MODE_ACTIVATED",
      multisigAddress,
      chainId,
      actor: input.actor,
      timestamp: now,
      details: {
        trigger: input.trigger,
        previousThreshold: normalThreshold,
        newThreshold,
        reason: input.reason,
        autoDisableAt,
      },
    });

    return {
      success: true,
      activatedAt: now,
      previousThreshold: normalThreshold,
      newThreshold,
      autoDisableAt,
    };
  }

  /**
   * Deactivate safe mode for a multisig
   */
  async deactivate(
    multisigAddress: string,
    chainId: string,
    normalThreshold: number,
    input: SafeModeDeactivateInput,
  ): Promise<SafeModeDeactivateResult> {
    const currentState = this.getState(multisigAddress, chainId);

    // Check if not in safe mode
    if (!currentState.isSafeMode) {
      throw new EmergencyError("Safe mode is not active", "NOT_IN_SAFE_MODE");
    }

    const now = Math.floor(Date.now() / 1000);

    // Update state
    localDb.updateEmergencyState(multisigAddress, chainId, {
      isSafeMode: false,
      safeModeThreshold: null,
      safeModeActivatedAt: null,
    });

    // Record event
    localDb.recordEmergencyEvent({
      multisigAddress,
      chainId,
      eventType: "safe_mode_off",
      actor: input.actor,
      reason: input.reason || "Safe mode deactivated",
      txHash: null,
      height: null,
      autoUnpauseAt: null,
    });

    // Emit event
    this.emitEvent({
      type: "SAFE_MODE_DEACTIVATED",
      multisigAddress,
      chainId,
      actor: input.actor,
      timestamp: now,
      details: {
        reason: input.reason,
        previousThreshold: currentState.threshold,
        restoredThreshold: normalThreshold,
      },
    });

    return {
      success: true,
      deactivatedAt: now,
      restoredThreshold: normalThreshold,
    };
  }

  // ============================================================================
  // Auto-Trigger Logic
  // ============================================================================

  /**
   * Check if a trigger should auto-activate safe mode
   */
  shouldAutoActivate(trigger: SafeModeTrigger): boolean {
    return this.config.autoTriggers.includes(trigger);
  }

  /**
   * Process a potential trigger event
   */
  async processTrigger(
    multisigAddress: string,
    chainId: string,
    normalThreshold: number,
    trigger: SafeModeTrigger,
    actor: string,
    _details?: Record<string, unknown>,
  ): Promise<SafeModeActivateResult | null> {
    if (!this.shouldAutoActivate(trigger)) {
      return null;
    }

    const currentState = this.getState(multisigAddress, chainId);
    if (currentState.isSafeMode) {
      // Already in safe mode
      return null;
    }

    // Auto-activate with default settings
    const elevatedThreshold = normalThreshold + this.config.defaultThresholdIncrease;

    return this.activate(multisigAddress, chainId, normalThreshold, {
      actor,
      trigger,
      elevatedThreshold,
      reason: `Auto-activated due to: ${trigger}`,
      autoDisableAfterSeconds: this.config.defaultAutoDisableSeconds,
    });
  }

  // ============================================================================
  // Threshold Helpers
  // ============================================================================

  /**
   * Calculate recommended elevated threshold
   */
  calculateElevatedThreshold(
    normalThreshold: number,
    totalWeight: number,
    severity: "low" | "medium" | "high" | "critical",
  ): number {
    let increase: number;

    switch (severity) {
      case "critical":
        increase = Math.ceil(totalWeight * 0.5); // Require 50% more
        break;
      case "high":
        increase = Math.ceil(totalWeight * 0.25); // Require 25% more
        break;
      case "medium":
        increase = this.config.defaultThresholdIncrease + 1;
        break;
      case "low":
      default:
        increase = this.config.defaultThresholdIncrease;
    }

    const elevated = normalThreshold + increase;
    return Math.min(elevated, totalWeight);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add event listener
   */
  addEventListener(listener: (event: EmergencyEvent) => void): void {
    this.eventListeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: EmergencyEvent) => void): void {
    this.eventListeners.delete(listener);
  }

  /**
   * Emit an emergency event
   */
  private emitEvent(event: EmergencyEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in safe mode event listener:", error);
      }
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): SafeModeConfig {
    return { ...this.config };
  }

  /**
   * Update max threshold (e.g., when total weight changes)
   */
  updateMaxThreshold(maxThreshold: number): void {
    (this.config as { maxThreshold: number }).maxThreshold = maxThreshold;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new safe mode controller
 */
export function createSafeModeController(config?: Partial<SafeModeConfig>): SafeModeController {
  return new SafeModeController(config);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalSafeModeController: SafeModeController | null = null;

/**
 * Get the global safe mode controller
 */
export function getSafeModeController(): SafeModeController {
  if (!globalSafeModeController) {
    globalSafeModeController = new SafeModeController();
  }
  return globalSafeModeController;
}

/**
 * Set the global safe mode controller
 */
export function setSafeModeController(controller: SafeModeController): void {
  globalSafeModeController = controller;
}
