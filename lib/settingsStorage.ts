/**
 * Settings Storage Utility
 * 
 * File: lib/settingsStorage.ts
 * 
 * Manages user security preferences stored in localStorage
 */

const SETTINGS_STORAGE_KEY = "cosmos-multisig-settings";

export interface UserSettings {
  // Require wallet signature verification to access "My Cliqs"
  // Default: false (no verification required)
  requireWalletSignInForCliqs: boolean;
  // Preferred developer console network mode
  preferredDevNetwork: "mainnet" | "testnet";
}

const defaultSettings: UserSettings = {
  requireWalletSignInForCliqs: false,
  preferredDevNetwork: "mainnet",
};

/**
 * Get user settings from localStorage
 * Returns default settings if none exist
 */
export const getUserSettings = (): UserSettings => {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(stored);
    // Merge with defaults to handle new settings added in future
    return { ...defaultSettings, ...parsed };
  } catch (e) {
    console.error("Failed to parse user settings:", e);
    return defaultSettings;
  }
};

/**
 * Update user settings in localStorage
 */
export const updateUserSettings = (updates: Partial<UserSettings>): void => {
  if (typeof window === "undefined") {
    return;
  }

  const current = getUserSettings();
  const updated = { ...current, ...updates };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Reset settings to defaults
 */
export const resetUserSettings = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
};
