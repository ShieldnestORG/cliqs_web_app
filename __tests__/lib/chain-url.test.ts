/**
 * setChainInUrl: the Back button and the page's own query survive
 *
 * File: __tests__/lib/chain-url.test.ts
 *
 * setChainInUrl (context/ChainsContext/storage.ts) runs every time a chain is set. Until
 * 2026-10-11 it called history.replaceState({}, ...) with the bare path. Two faults, both
 * measured on app.cliqs.io on 2026-10-11:
 *   - Next.js (15.5.27, shared/lib/router/router.js onPopState) ignores a Back or Forward step
 *     whose history state has no `__N` marker, so after leaving the page Back changed the address
 *     bar but left the next page on screen;
 *   - the query was dropped, so /tx/validator?address=<cliq> lost `?address=` in the bar and a
 *     refresh opened the connected wallet's own validator view instead of the CLIQ's.
 *
 * Priority: P1
 */

import { setChainInUrl } from "@/context/ChainsContext/storage";
import type { ChainInfo, ChainItems } from "@/context/ChainsContext/types";

const tx = {
  registryName: "tx",
  logo: "",
  chainId: "coreum-testnet-1",
  chainDisplayName: "TX",
  nodeAddress: "https://rpc.invalid:26657",
  nodeAddresses: ["https://rpc.invalid:26657"],
  denom: "utestcore",
  displayDenom: "TX",
  displayDenomExponent: 6,
  assets: [],
  gasPrice: "0.0625utestcore",
  addressPrefix: "testcore",
  explorerLinks: { tx: "", account: "" },
} as ChainInfo;

const registry = {
  mainnets: new Map(),
  testnets: new Map([["tx", tx]]),
  localnets: new Map(),
} as unknown as ChainItems;

const notInRegistry = {
  mainnets: new Map(),
  testnets: new Map(),
  localnets: new Map(),
} as unknown as ChainItems;

/** What Next.js writes for a page it rendered (the part of it this test relies on). */
const nextState = (as: string) => ({ __N: true, as, url: as, key: "k1", options: {} });

const CLIQ = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";

describe("setChainInUrl: P1", () => {
  it("keeps Next.js's history state, so Back still changes the page", () => {
    const at = `/tx/validator?address=${CLIQ}`;
    window.history.replaceState(nextState(at), "", at);

    setChainInUrl(tx, registry);

    expect(window.history.state).toEqual(nextState(at));
  });

  it("keeps the page's own query: ?address= and ?type= stay in the address bar", () => {
    window.history.replaceState(nextState("x"), "", `/tx/validator?address=${CLIQ}`);
    setChainInUrl(tx, registry);
    expect(window.location.pathname + window.location.search).toBe(`/tx/validator?address=${CLIQ}`);

    const type = encodeURIComponent("/cosmos.bank.v1beta1.MsgSend");
    window.history.replaceState(nextState("y"), "", `/tx/${CLIQ}/transaction/new?type=${type}`);
    setChainInUrl(tx, registry);
    expect(window.location.search).toBe(`?type=${type}`);
  });

  it("still drops chain settings from the query of a registry chain", () => {
    window.history.replaceState(
      nextState("z"),
      "",
      `/tx/validator?address=${CLIQ}&chainId=evil-1&nodeAddresses=%5B%5D`,
    );

    setChainInUrl(tx, registry);

    expect(window.location.search).toBe(`?address=${CLIQ}`);
  });

  it("puts the chain in the path when the path does not name it, as before", () => {
    window.history.replaceState(nextState("/"), "", "/");

    setChainInUrl(tx, registry);

    expect(window.location.pathname).toBe("/tx");
    expect(window.location.search).toBe("");
  });

  it("keeps Next.js's history state for a chain outside the registry too", () => {
    window.history.replaceState(nextState("/tx/dashboard"), "", "/tx/dashboard");

    setChainInUrl(tx, notInRegistry);

    expect(window.history.state).toEqual(nextState("/tx/dashboard"));
    // that branch still writes the chain into the query, unchanged
    expect(new URLSearchParams(window.location.search).get("chainId")).toBe("coreum-testnet-1");
  });
});
