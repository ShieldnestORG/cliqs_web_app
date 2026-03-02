# CLIQ and Validator Association — Audit Verification Report

**Date:** 2026-03-02  
**Scope:** Implementation of "Show Both Validator and CLIQ Associations" plus audit hardening fixes.

---

## 1. Test Results

### Relevant Tests (Direct Scope)

| Test File | Result | Notes |
|-----------|--------|-------|
| `__tests__/pages/dashboard.test.tsx` | PASS | Dashboard loads, tabs, quick stats, chain name, create button |
| `__tests__/pages/validator.test.tsx` | PASS | Validator page loads; dashboard component rendered (mocked) |

**Note:** Both tests mock child components (`ListUserCliqs`, `ValidatorDashboard`). They verify page-level rendering and routing, not the new CLIQ/validator logic.

**Fix during audit:** Dashboard previously caused "Maximum update depth exceeded" when wallet was disconnected (test env): the effect ran `checkValidators()`, which called `setState` in the early-return path, triggering re-renders in a loop. Fixed by guarding the effect: only call `checkValidators()` when `walletInfo?.address`, `chain.nodeAddress`, and `chain.addressPrefix` are present. Also stabilized `checkValidators` deps (use `chain.chainId`, `chain.nodeAddress`, `chain.addressPrefix` instead of `chain` object) to avoid reference churn.

### Full Suite (Pre-existing Failures)

- Emergency controls, emergency-pause, index, chain-selection: failures unrelated to CLIQ/validator changes
- list-multisigs, create-transaction, view-transaction: BSON/mongodb ESM parsing — infrastructure, not application code
- gas.fuzz.spec: `createDefaultAminoConverters` — cosmjs dependency issue

---

## 2. Lint and Build

| Check | Result |
|-------|--------|
| ESLint (`npm run lint`) | PASS — no warnings, max-warnings 0 |
| Next.js build (`npm run build`) | PASS — compiled successfully, types valid |
| IDE linter (dashboard, ValidatorDashboard) | No errors |

---

## 3. Implementation Verification

### Dashboard ([pages/[chainName]/dashboard.tsx](pages/[chainName]/dashboard.tsx))

- **Verification alignment:** Uses `getUserSettings()`, `verify()` when `requireWalletSignInForCliqs`; passes `{ signature }` or `{ address, pubkey }` to `getDbUserMultisigs`
- **Retry UX:** `cliqFetchError` state, amber banner with Retry when CLIQ fetch fails
- **checkValidators:** Extracted to `useCallback` for retry; clears `cliqFetchError` at start of run

### ValidatorDashboard ([components/dataViews/ValidatorDashboard/index.tsx](components/dataViews/ValidatorDashboard/index.tsx))

- **requireWalletSignInForCliqs:** Only calls `verify()` when `getUserSettings().requireWalletSignInForCliqs === true`; otherwise uses `{ address, pubkey }`
- **getDbUserMultisigs shape:** Passes `{ signature }` or `{ address, pubkey }` exclusively (no mixed payload)
- **fetchAssociatedValidators trigger:** Runs when `loadingState === "not-validator"` or when `loadingState === "loaded"` and `effectiveAddress === walletInfo.address`
- **"You also manage via CLIQ":** Renders when `!isCliqMode`, `effectiveAddress === walletInfo.address`, `chain.registryName`, and `cliqOnlyValidators.length > 0`
- **cliqOnlyValidators:** Memoized with `useMemo`; used for condition and map
- **Early exit:** If verification required and user cancels, sets `associatedValidators` to `[]` and returns

---

## 4. Pre-existing Issues (Out of Scope)

1. **Nested anchor warning:** Validator page Breadcrumb uses `BreadcrumbLink asChild` wrapping a link inside another link context — hydration warning; not in ValidatorDashboard.
2. **TypeScript in tests:** `tsc --noEmit` reports errors in `__tests__/` (Jest globals, etc.). Next.js build type-check passes for app code.
3. **ListUserCliqs Keplr-only:** `walletInfo.type !== "Keplr"` prevents Ledger users from loading CLIQs on that tab; dashboard does not restrict by type.

---

## 5. Audit Checklist

| Item | Status |
|------|--------|
| Dashboard honors requireWalletSignInForCliqs | DONE |
| ValidatorDashboard honors requireWalletSignInForCliqs | DONE |
| getDbUserMultisigs call shape (signature OR address+pubkey) | DONE |
| chain.registryName guard on CLIQ section links | DONE |
| cliqOnlyValidators memoized | DONE |
| Fetch associated validators when wallet is direct validator | DONE |
| Retry UX when CLIQ fetch fails on dashboard | DONE |
| Lint passes | DONE |
| Build passes | DONE |
| Relevant page tests pass | DONE |

---

## 6. Conclusion

The CLIQ and Validator Association changes meet the audit requirements. Lint and build pass; behavior and structure match the spec and hardening guidance. Existing test and infrastructure issues are outside this scope.
