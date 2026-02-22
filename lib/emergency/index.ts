/**
 * Emergency Module Exports
 * 
 * File: lib/emergency/index.ts
 * 
 * Central export point for Phase 4 emergency controls.
 * Includes pause mechanism and safe mode.
 */

// Types
export {
  type EmergencyState,
  type PauseInput,
  type PauseResult,
  type UnpauseInput,
  type UnpauseResult,
  type SafeModeTrigger,
  type SafeModeActivateInput,
  type SafeModeActivateResult,
  type SafeModeDeactivateInput,
  type SafeModeDeactivateResult,
  type EmergencyEventType,
  type EmergencyEvent,
  type EmergencyAuthority,
  type EmergencyErrorCode,
  EmergencyError,
  DEFAULT_EMERGENCY_STATE,
} from "./types";

// Pause Controller
export {
  PauseController,
  createPauseController,
  getPauseController,
  setPauseController,
  type PauseControllerConfig,
} from "./pause-controller";

// Safe Mode Controller
export {
  SafeModeController,
  createSafeModeController,
  getSafeModeController,
  setSafeModeController,
  type SafeModeConfig,
} from "./safe-mode";

