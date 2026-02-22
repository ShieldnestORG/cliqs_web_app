/**
 * Alerts Module Exports
 * 
 * File: lib/alerts/index.ts
 * 
 * Central export point for Phase 4 alerting infrastructure.
 */

export {
  type AlertChannel,
  type AlertSeverity,
  type AlertConfig,
  type AlertChannelConfig,
  type AlertCondition,
  type Alert,
  AlertEngine,
  createAlertEngine,
  createCriticalEventsRule,
  createEmergencyEventsRule,
  getAlertEngine,
  setAlertEngine,
} from "./engine";

