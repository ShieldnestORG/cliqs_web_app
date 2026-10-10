/**
 * Phase 4 removal: the deleted routes and components stay deleted
 *
 * File: __tests__/lib/phase4-removed.test.ts
 *
 * The policy, emergency-pause and monitoring features were never used by the app, and their eight
 * API routes accepted writes with no sign-in. They were deleted on 2026-10-10 (archived at git tag
 * archive/phase4-policies-2026-10-10). This suite fails if any of those files comes back, so a
 * restore has to be a deliberate decision with its own sign-in and tests, not a merge accident.
 *
 * lib/policies/types.ts is NOT in the list: lib/multisig/contract-engine.ts imports it.
 */

import fs from "fs";
import path from "path";

const root = process.cwd();

const REMOVED_ROUTES = [
  "pages/api/chain/[chainId]/[address]/emergency/pause.ts",
  "pages/api/chain/[chainId]/[address]/emergency/safe-mode.ts",
  "pages/api/chain/[chainId]/[address]/emergency/status.ts",
  "pages/api/chain/[chainId]/[address]/monitoring/alerts.ts",
  "pages/api/chain/[chainId]/[address]/monitoring/incidents.ts",
  "pages/api/chain/[chainId]/[address]/monitoring/metrics.ts",
  "pages/api/chain/[chainId]/[address]/policies/index.ts",
  "pages/api/chain/[chainId]/[address]/policies/[policyId].ts",
];

const REMOVED_COMPONENTS = ["components/policies", "components/emergency", "components/monitoring"];

describe("Phase 4 removal", () => {
  test.each(REMOVED_ROUTES)("route %s is gone", (route) => {
    expect(fs.existsSync(path.join(root, route))).toBe(false);
  });

  test.each(REMOVED_COMPONENTS)("%s is gone", (removed) => {
    expect(fs.existsSync(path.join(root, removed))).toBe(false);
  });

  test("lib/policies/types.ts stays, because the contract engine imports it", () => {
    expect(fs.existsSync(path.join(root, "lib/policies/types.ts"))).toBe(true);
  });
});
