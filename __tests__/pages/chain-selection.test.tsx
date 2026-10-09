/**
 * Chain Root Route Test
 *
 * File: __tests__/pages/chain-selection.test.tsx
 *
 * /[chainName] has no page of its own any more: it redirects to Home
 * (/[chainName]/dashboard) from getServerSideProps. A config redirect would
 * also catch /robots.txt, so the stub is the mechanism under test.
 *
 * Priority: P0
 */

import type { GetServerSidePropsContext } from "next";
import ChainRoot, { getServerSideProps } from "@/pages/[chainName]/index";

const run = (chainName: string) =>
  getServerSideProps({ params: { chainName } } as unknown as GetServerSidePropsContext);

describe("Chain root route (/[chainName]): P0", () => {
  it("redirects to Home for the chain in the URL", async () => {
    await expect(run("tx")).resolves.toEqual({
      redirect: { destination: "/tx/dashboard", permanent: false },
    });
  });

  it("keeps the alias the visitor used", async () => {
    await expect(run("coreum-mainnet")).resolves.toEqual({
      redirect: { destination: "/coreum-mainnet/dashboard", permanent: false },
    });
  });

  it("is temporary (307) until a preview check", async () => {
    const result = await run("cosmos");
    expect(result).toHaveProperty("redirect.permanent", false);
  });

  it("renders nothing if it is ever reached on the client", () => {
    expect(ChainRoot()).toBeNull();
  });
});
