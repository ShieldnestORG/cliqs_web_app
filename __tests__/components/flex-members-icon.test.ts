/**
 * Flex CLIQ members use the members glyph, not the stakers one
 *
 * File: __tests__/components/flex-members-icon.test.ts
 *
 * Owner, 2026-10-11 ("g yes"): the stakers glyph stood for Flex CLIQ members on the Guides card
 * and the create form header. Both now use `members`; the validator page keeps `stakers`.
 *
 * Priority: P2
 */

import fs from "node:fs";
import path from "node:path";
import { userJourneys } from "@/lib/userJourneys";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");

it("the Flex guide card shows the members glyph", () => {
  const flex = userJourneys.find((j) => j.title === "Create a Flex Multisig");
  expect(flex?.icon).toBe("members");
});

it("the Flex create form header shows the members glyph, and no stakers glyph", () => {
  const form = read("components/forms/CreateFlexCliqForm/index.tsx");
  expect(form).toMatch(/<KitIcon name="members"/);
  expect(form).not.toMatch(/name="stakers"/);
});

it("the validator page still uses stakers for stakers", () => {
  expect(read("components/dataViews/ValidatorDashboard/ValidatorDelegatorsCard.tsx")).toMatch(
    /<KitIcon name="stakers"/,
  );
});
