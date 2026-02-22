/**
 * Pause Controller - Emergency Pause Mechanism
 * 
 * File: lib/emergency/pause-controller.ts
 * 
 * Implements the emergency pause mechanism for multisigs.
 * This is a Priority 2 feature that provides a "kill switch" for operations.
 * 
 * Key Design Rules:
 * - Pause blocks new approvals and execution
 * - Queries are still allowed
 * - Credential checks are NOT bypassed
 * - Unpause requires higher threshold (N+1) OR timelocked admin action
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import * as localDb from "@/lib/localDb";
import {
  EmergencyState,
  PauseInput,
  PauseResult,
  UnpauseInput,
  UnpauseResult,
  EmergencyEvent,
  EmergencyError,
  DEFAULT_EMERGENCY_STATE,
} from "./types";

// ============================================================================
// Pause Controller Configuration
// ============================================================================

export interface PauseControllerConfig {
  /** Minimum unpause threshold multiplier (e.g., 1 means N+1) */
  readonly unpauseThresholdOffset: number;
  /** Minimum timelock for admin unpause (seconds) */
  readonly adminUnpauseTimelockSeconds: number;
  /** Maximum pause duration allowed (seconds) */
  readonly maxPauseDurationSeconds: number;
  /** Default pause duration if none specified (seconds) */
  readonly defaultPauseDurationSeconds: number;
}

const DEFAULT_CONFIG: PauseControllerConfig = {
  unpauseThresholdOffset: 1, // Require N+1 for unpause
  adminUnpauseTimelockSeconds: 86400, // 24 hours
  maxPauseDurationSeconds: 604800, // 7 days
  defaultPauseDurationSeconds: 86400, // 1 day
};

// ============================================================================
// Pause Controller Implementation
// ============================================================================

export class PauseController {
  private readonly config: PauseControllerConfig;
  private readonly eventListeners: Set<(event: EmergencyEvent) => void> = new Set();

  constructor(config: Partial<PauseControllerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // State Management
  // ============================================================================

  /**
   * Get current emergency state for a multisig
   */
  getState(multisigAddress: string, chainId: string): EmergencyState {
    const dbState = localDb.getEmergencyState(multisigAddress, chainId);
    
    if (!dbState) {
      return DEFAULT_EMERGENCY_STATE;
    }

    // Check for auto-unpause
    if (dbState.isPaused && dbState.autoUnpauseAt) {
      const autoUnpauseTimestamp = new Date(dbState.autoUnpauseAt).getTime() / 1000;
      const now = Math.floor(Date.now() / 1000);
      
      if (now >= autoUnpauseTimestamp) {
        // Auto-unpause has triggered
        localDb.updateEmergencyState(multisigAddress, chainId, {
          isPaused: false,
          pausedAt: null,
          pausedBy: null,
          pauseReason: null,
          autoUnpauseAt: null,
        });
        
        localDb.recordEmergencyEvent({
          multisigAddress,
          chainId,
          eventType: "unpause",
          actor: "system",
          reason: "Auto-unpause triggered",
          txHash: null,
          height: null,
          autoUnpauseAt: null,
        });
        
        this.emitEvent({
          type: "EMERGENCY_UNPAUSED",
          multisigAddress,
          chainId,
          actor: "system",
          timestamp: now,
          details: { reason: "auto_unpause" },
        });
        
        return DEFAULT_EMERGENCY_STATE;
      }
    }

    return {
      isPaused: dbState.isPaused,
      pausedAt: dbState.pausedAt ? new Date(dbState.pausedAt).getTime() / 1000 : null,
      pausedBy: dbState.pausedBy,
      pauseReason: dbState.pauseReason,
      autoUnpauseAt: dbState.autoUnpauseAt ? new Date(dbState.autoUnpauseAt).getTime() / 1000 : null,
      isSafeMode: dbState.isSafeMode,
      safeModeThreshold: dbState.safeModeThreshold,
      safeModeActivatedAt: dbState.safeModeActivatedAt 
        ? new Date(dbState.safeModeActivatedAt).getTime() / 1000 
        : null,
    };
  }

  /**
   * Check if multisig is currently paused
   */
  isPaused(multisigAddress: string, chainId: string): boolean {
    return this.getState(multisigAddress, chainId).isPaused;
  }

  // ============================================================================
  // Pause Operations
  // ============================================================================

  /**
   * Pause operations for a multisig
   * 
   * When paused:
   * - No new approvals allowed
   * - No execution allowed
   * - Queries still work
   * - Credential checks still enforced
   */
  async pause(
    multisigAddress: string,
    chainId: string,
    input: PauseInput,
  ): Promise<PauseResult> {
    const currentState = this.getState(multisigAddress, chainId);
    
    // Check if already paused
    if (currentState.isPaused) {
      throw new EmergencyError(
        "Multisig is already paused",
        "ALREADY_PAUSED",
        { pausedAt: currentState.pausedAt, pausedBy: currentState.pausedBy },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Calculate auto-unpause time
    let autoUnpauseAt: number | null = null;
    if (input.durationSeconds !== undefined) {
      const duration = Math.min(input.durationSeconds, this.config.maxPauseDurationSeconds);
      autoUnpauseAt = now + duration;
    }

    // Update state
    localDb.updateEmergencyState(multisigAddress, chainId, {
      isPaused: true,
      pausedAt: new Date(now * 1000).toISOString(),
      pausedBy: input.actor,
      pauseReason: input.reason,
      autoUnpauseAt: autoUnpauseAt ? new Date(autoUnpauseAt * 1000).toISOString() : null,
    });

    // Record event
    localDb.recordEmergencyEvent({
      multisigAddress,
      chainId,
      eventType: "pause",
      actor: input.actor,
      reason: input.reason,
      txHash: null,
      height: null,
      autoUnpauseAt: autoUnpauseAt ? new Date(autoUnpauseAt * 1000).toISOString() : null,
    });

    // Emit event
    this.emitEvent({
      type: "EMERGENCY_PAUSED",
      multisigAddress,
      chainId,
      actor: input.actor,
      timestamp: now,
      details: {
        reason: input.reason,
        autoUnpauseAt,
      },
    });

    return {
      success: true,
      pausedAt: now,
      autoUnpauseAt,
    };
  }

  /**
   * Unpause operations for a multisig
   * 
   * Unpause requires:
   * - Higher threshold (N+1) OR
   * - Timelocked admin action (24h minimum)
   */
  async unpause(
    multisigAddress: string,
    chainId: string,
    input: UnpauseInput,
  ): Promise<UnpauseResult> {
    const currentState = this.getState(multisigAddress, chainId);
    
    // Check if not paused
    if (!currentState.isPaused) {
      throw new EmergencyError(
        "Multisig is not paused",
        "NOT_PAUSED",
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Update state
    localDb.updateEmergencyState(multisigAddress, chainId, {
      isPaused: false,
      pausedAt: null,
      pausedBy: null,
      pauseReason: null,
      autoUnpauseAt: null,
    });

    // Record event
    localDb.recordEmergencyEvent({
      multisigAddress,
      chainId,
      eventType: "unpause",
      actor: input.actor,
      reason: "Manual unpause",
      txHash: null,
      height: null,
      autoUnpauseAt: null,
    });

    // Emit event
    this.emitEvent({
      type: "EMERGENCY_UNPAUSED",
      multisigAddress,
      chainId,
      actor: input.actor,
      timestamp: now,
      details: { manualUnpause: true },
    });

    return {
      success: true,
      unpausedAt: now,
    };
  }

  // ============================================================================
  // Threshold Calculation
  // ============================================================================

  /**
   * Calculate required threshold for unpause
   */
  getUnpauseThreshold(normalThreshold: number, totalWeight: number): number {
    const elevated = normalThreshold + this.config.unpauseThresholdOffset;
    // Never exceed total weight
    return Math.min(elevated, totalWeight);
  }

  /**
   * Calculate minimum timelock for admin unpause
   */
  getAdminUnpauseTimelock(): number {
    return this.config.adminUnpauseTimelockSeconds;
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Check if an operation is blocked by pause
   */
  isOperationBlocked(
    multisigAddress: string,
    chainId: string,
    operation: "approve" | "execute" | "query",
  ): { blocked: boolean; reason?: string } {
    if (operation === "query") {
      // Queries are never blocked
      return { blocked: false };
    }

    const state = this.getState(multisigAddress, chainId);
    
    if (state.isPaused) {
      return {
        blocked: true,
        reason: state.pauseReason || "Operations are paused",
      };
    }

    return { blocked: false };
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
        console.error("Error in emergency event listener:", error);
      }
    }
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): PauseControllerConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new pause controller
 */
export function createPauseController(
  config?: Partial<PauseControllerConfig>,
): PauseController {
  return new PauseController(config);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalPauseController: PauseController | null = null;

/**
 * Get the global pause controller
 */
export function getPauseController(): PauseController {
  if (!globalPauseController) {
    globalPauseController = new PauseController();
  }
  return globalPauseController;
}

/**
 * Set the global pause controller
 */
export function setPauseController(controller: PauseController): void {
  globalPauseController = controller;
}

