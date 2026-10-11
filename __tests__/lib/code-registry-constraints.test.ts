/**
 * Contract Code Registry — chain constraints REST derivation test
 *
 * File: __tests__/lib/code-registry-constraints.test.ts
 *
 * Covers the codeRegistry copy of the REST-derivation bug fixed in
 * lib/validatorHelpers.ts on 2026-08-31: codeRegistry's local
 * deriveRestEndpoints did port arithmetic only and put the raw RPC URL first,
 * so for port-less hosted endpoints (e.g. coreum-rpc.polkachu.com) the ONLY
 * candidate was the RPC URL, which 404s REST paths. queryChainConstraints now
 * uses the shared lib/restEndpoints.ts derivation and threads the chain's
 * configured restEndpoint through.
 *
 * Priority: P1
 */

import { queryChainConstraints } from "@/lib/contract/codeRegistry";

const RPC = "https://coreum-rpc.polkachu.com";
const REST = "https://rest-01.mainnet-1.tx.org/";

// One body that satisfies both queryWasmParams (reads .params) and
// queryNodeInfo (reads .application_version)
const liveChainResponse = {
  ok: true,
  json: async () => ({
    params: {
      code_upload_access: { permission: "Everybody" },
      instantiate_default_permission: "Everybody",
      max_wasm_code_size: "819200",
    },
    application_version: { version: "v1.0.0", cosmos_sdk_version: "v0.47.0" },
  }),
};

describe("queryChainConstraints REST derivation: P1", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("tries the chain's configured restEndpoint first, not the raw RPC URL", async () => {
    global.fetch = jest.fn().mockResolvedValue(liveChainResponse);

    const constraints = await queryChainConstraints(RPC, "constraints-test-rest-first", REST);

    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toBe("https://rest-01.mainnet-1.tx.org/cosmwasm/wasm/v1/codes/params");
    expect(constraints.wasmSizeLimitKB).toBe(800);
  });

  it("derives provider-style -api. hostnames for port-less hosted RPCs, raw RPC URL last", async () => {
    // The old local copy would have tried ONLY the RPC URL here
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await queryChainConstraints(RPC, "constraints-test-api-swap");

    const urls = (global.fetch as jest.Mock).mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.startsWith("https://coreum-api.polkachu.com/"))).toBe(true);
    expect(urls[0]).not.toContain("coreum-rpc.polkachu.com");
    expect(urls[urls.length - 1]).toContain("coreum-rpc.polkachu.com");
  });
});
