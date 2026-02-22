/**
 * Data Retention Utilities
 *
 * File: lib/dataRetention.ts
 *
 * Provides helpers for computing data retention deadlines, warnings,
 * and storage quotas.  Configuration comes from environment variables
 * with sensible defaults.
 */

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_WARNING_DAYS = 14;
const DEFAULT_MAX_STORAGE_KB = 500;

export function getRetentionDays(): number {
  const env = process.env.DATA_RETENTION_DAYS ?? process.env.NEXT_PUBLIC_DATA_RETENTION_DAYS;
  const parsed = Number(env);
  return parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
}

export function getWarningDaysBefore(): number {
  const env = process.env.DATA_WARNING_DAYS_BEFORE ?? process.env.NEXT_PUBLIC_DATA_WARNING_DAYS_BEFORE;
  const parsed = Number(env);
  return parsed > 0 ? parsed : DEFAULT_WARNING_DAYS;
}

export function getMaxStorageKB(): number {
  const env = process.env.MAX_STORAGE_PER_USER_KB ?? process.env.NEXT_PUBLIC_MAX_STORAGE_PER_USER_KB;
  const parsed = Number(env);
  return parsed > 0 ? parsed : DEFAULT_MAX_STORAGE_KB;
}

export interface RetentionInfo {
  createdAt: Date;
  expiresAt: Date;
  warningAt: Date;
  daysRemaining: number;
  isExpired: boolean;
  isWarning: boolean;
}

export function getRetentionInfo(createdAtISO: string): RetentionInfo {
  const retentionDays = getRetentionDays();
  const warningDays = getWarningDaysBefore();

  const createdAt = new Date(createdAtISO);
  const expiresAt = new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  const warningAt = new Date(expiresAt.getTime() - warningDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

  return {
    createdAt,
    expiresAt,
    warningAt,
    daysRemaining,
    isExpired: now >= expiresAt,
    isWarning: now >= warningAt && now < expiresAt,
  };
}
