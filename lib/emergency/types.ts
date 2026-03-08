/**
 * Emergency Types
 *
 * File: lib/emergency/types.ts
 *
 * Types for the emergency control system including pause mechanism
 * and safe mode.
 *
 * Key Design Rules (from Phase 4 requirements):
 * - Emergency authority does NOT bypass credential checks
 * - It only gates execution paths
 * - No "superuser" behavior
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

// ============================================================================
// Emergency State Types
// ============================================================================

/**
 * Current emergency state for a multisig
 */
export interface EmergencyState {
  /** Whether operations are currently paused */
  readonly isPaused: boolean;
  /** When pause was activated */
  readonly pausedAt: number | null;
  /** Who activated the pause */
  readonly pausedBy: string | null;
  /** Reason for pause */
  readonly pauseReason: string | null;
  /** Auto-unpause timestamp (null = manual only) */
  readonly autoUnpauseAt: number | null;
  /** Whether safe mode is active */
  readonly isSafeMode: boolean;
  /** Elevated threshold during safe mode */
  readonly safeModeThreshold: number | null;
  /** When safe mode was activated */
  readonly safeModeActivatedAt: number | null;
}

/**
 * Default (non-emergency) state
 */
export const DEFAULT_EMERGENCY_STATE: EmergencyState = {
  isPaused: false,
  pausedAt: null,
  pausedBy: null,
  pauseReason: null,
  autoUnpauseAt: null,
  isSafeMode: false,
  safeModeThreshold: null,
  safeModeActivatedAt: null,
};

// ============================================================================
// Pause Types
// ============================================================================

/**
 * Input for pause operation
 */
export interface PauseInput {
  /** Address initiating the pause */
  readonly actor: string;
  /** Reason for pause */
  readonly reason: string;
  /** Duration in seconds (null = indefinite) */
  readonly durationSeconds?: number;
}

/**
 * Result of pause operation
 */
export interface PauseResult {
  readonly success: boolean;
  readonly pausedAt: number;
  readonly autoUnpauseAt: number | null;
  readonly error?: string;
}

/**
 * Input for unpause operation
 */
export interface UnpauseInput {
  /** Address initiating the unpause */
  readonly actor: string;
  /** Reason for unpause */
  readonly reason?: string;
  /** Verification that actor has required authority */
  readonly skipThresholdCheck?: boolean;
}

/**
 * Result of unpause operation
 */
export interface UnpauseResult {
  readonly success: boolean;
  readonly unpausedAt: number;
  readonly error?: string;
}

// ============================================================================
// Safe Mode Types
// ============================================================================

/**
 * Trigger conditions for safe mode
 */
export type SafeModeTrigger =
  | "manual" // Admin activated manually
  | "anomaly_detected" // Anomaly detection triggered
  | "credential_revoked" // Credential revocation in progress
  | "high_risk_activity" // Unusual activity pattern
  | "external_signal"; // External oracle/API signal

/**
 * Input for activating safe mode
 */
export interface SafeModeActivateInput {
  /** Address initiating safe mode */
  readonly actor: string;
  /** What triggered safe mode */
  readonly trigger: SafeModeTrigger;
  /** Elevated threshold to use */
  readonly elevatedThreshold: number;
  /** Reason for activation */
  readonly reason?: string;
  /** Auto-disable after this many seconds */
  readonly autoDisableAfterSeconds?: number;
}

/**
 * Result of safe mode activation
 */
export interface SafeModeActivateResult {
  readonly success: boolean;
  readonly activatedAt: number;
  readonly previousThreshold: number;
  readonly newThreshold: number;
  readonly autoDisableAt: number | null;
  readonly error?: string;
}

/**
 * Input for deactivating safe mode
 */
export interface SafeModeDeactivateInput {
  /** Address deactivating safe mode */
  readonly actor: string;
  /** Reason for deactivation */
  readonly reason?: string;
}

/**
 * Result of safe mode deactivation
 */
export interface SafeModeDeactivateResult {
  readonly success: boolean;
  readonly deactivatedAt: number;
  readonly restoredThreshold: number;
  readonly error?: string;
}

// ============================================================================
// Emergency Event Types (for guaranteed event emission)
// ============================================================================

/**
 * Types of emergency events
 */
export type EmergencyEventType =
  | "EMERGENCY_PAUSED"
  | "EMERGENCY_UNPAUSED"
  | "SAFE_MODE_ACTIVATED"
  | "SAFE_MODE_DEACTIVATED";

/**
 * Emergency event with guaranteed attributes
 */
export interface EmergencyEvent {
  readonly type: EmergencyEventType;
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly actor: string;
  readonly timestamp: number;
  readonly details: Record<string, unknown>;
}

// ============================================================================
// Emergency Authority Types
// ============================================================================

/**
 * Who has authority to perform emergency actions
 */
export interface EmergencyAuthority {
  /** Addresses that can pause (usually admins) */
  readonly canPause: readonly string[];
  /** Addresses that can unpause (usually N+1 threshold or timelocked) */
  readonly canUnpause: readonly string[];
  /** Addresses that can activate safe mode */
  readonly canActivateSafeMode: readonly string[];
  /** Addresses that can deactivate safe mode */
  readonly canDeactivateSafeMode: readonly string[];
}

// ============================================================================
// Error Types
// ============================================================================

export type EmergencyErrorCode =
  | "NOT_AUTHORIZED"
  | "ALREADY_PAUSED"
  | "NOT_PAUSED"
  | "ALREADY_IN_SAFE_MODE"
  | "NOT_IN_SAFE_MODE"
  | "INVALID_THRESHOLD"
  | "OPERATION_FAILED";

export class EmergencyError extends Error {
  constructor(
    message: string,
    public readonly code: EmergencyErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EmergencyError";
  }
}
