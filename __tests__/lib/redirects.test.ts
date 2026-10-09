/**
 * next.config.js redirects()
 *
 * File: __tests__/lib/redirects.test.ts
 *
 * Old URLs from before the 2026-10 flow cleanup. Order matters: Next takes the
 * first match, so the operations?tab=validators rule must precede the catch-all
 * for operations. /:chainName must NOT be redirected here (it would catch
 * /robots.txt, /llms.txt and /favicon.ico; pages/[chainName]/index.tsx does it).
 *
 * Priority: P0
 */

const nextConfig = require("../../next.config.js");

type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
  has?: { type: string; key: string; value?: string }[];
};

describe("next.config.js redirects(): P0", () => {
  let redirects: Redirect[];

  beforeAll(async () => {
    redirects = await nextConfig.redirects();
  });

  it("lists exactly three redirects, in order", () => {
    expect(redirects.map((r) => `${r.source} -> ${r.destination}`)).toEqual([
      "/:chainName/operations -> /:chainName/validator",
      "/:chainName/operations -> /:chainName/dashboard",
      "/:chainName/account -> /:chainName/settings",
    ]);
  });

  it("sends operations?tab=validators to the validator page, before the catch-all", () => {
    expect(redirects[0].has).toEqual([{ type: "query", key: "tab", value: "validators" }]);
    expect(redirects[1].has).toBeUndefined();
  });

  it("ships every redirect as temporary until a preview check", () => {
    for (const redirect of redirects) {
      expect(redirect.permanent).toBe(false);
    }
  });

  it("does not redirect the bare chain route", () => {
    expect(redirects.some((r) => r.source === "/:chainName")).toBe(false);
  });
});
