/**
 * Feature flags
 *
 * File: lib/featureFlags.ts
 */

/**
 * Whether to offer Dev Tools in the navigation.
 *
 * The /dev screen can construct, sign and broadcast real transactions. Listing
 * it beside Account and Settings gives it the same weight as ordinary settings
 * for a validator operator who has no reason to go there.
 *
 * This gates the nav entry only — the /[chainName]/dev route still resolves, so
 * anyone who needs it can navigate to it directly, and existing links and
 * bookmarks keep working.
 *
 * Set NEXT_PUBLIC_ENABLE_DEVTOOLS=true to show it in a production build.
 */
export const showDevTools =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS === "true";
