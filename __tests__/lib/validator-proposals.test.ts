/**
 * Validator Governance Proposals Test
 *
 * File: __tests__/lib/validator-proposals.test.ts
 *
 * Covers the TX/Coreum failure measured 2026-08-31: the node rejects the whole
 * v1beta1 proposals query with "can't convert a gov/v1 Proposal to gov/v1beta1
 * Proposal when amount of proposal messages not exactly one" whenever any live
 * proposal is a v1 text proposal, and the old REST fallback probed ONLY the RPC
 * URL (which 404s REST paths) for port-less hosted endpoints. Net effect: the
 * validator page claimed "no active proposals" while proposal #46 was in its
 * voting period.
 *
 * Priority: P0
 */

import { deriveRestEndpoints, getActiveProposals, getPastProposals } from "@/lib/validatorHelpers";

const RPC = "https://coreum-rpc.polkachu.com";
const REST = "https://rest-01.mainnet-1.tx.org/";

const v1Proposal = (id: string, status: string) => ({
  id,
  status,
  title: `Proposal ${id}`,
  summary: "s",
  messages: [],
  voting_end_time: "2026-09-02T19:14:39Z",
});

const restResponse = (proposals: unknown[]) => ({
  ok: true,
  json: async () => ({ proposals }),
});

// A query client whose v1beta1 gov query fails the way Coreum's does
const throwingQueryClient = {
  gov: {
    proposals: jest
      .fn()
      .mockRejectedValue(
        new Error(
          "Query failed with (6): can't convert a gov/v1 Proposal to gov/v1beta1 Proposal when amount of proposal messages not exactly one",
        ),
      ),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe("deriveRestEndpoints: P0", () => {
  it("puts the chain's configured restEndpoint first and the raw RPC URL last", () => {
    const endpoints = deriveRestEndpoints(RPC, REST);
    expect(endpoints[0]).toBe("https://rest-01.mainnet-1.tx.org");
    expect(endpoints[endpoints.length - 1]).toBe(RPC);
  });

  it("derives provider-style api/rest hostnames from -rpc. hosts", () => {
    const endpoints = deriveRestEndpoints(RPC);
    expect(endpoints).toContain("https://coreum-api.polkachu.com");
    // The raw RPC URL must not be the ONLY candidate (the original bug)
    expect(endpoints.length).toBeGreaterThan(1);
  });

  it("still derives the 1317 REST port from a 26657 RPC port", () => {
    const endpoints = deriveRestEndpoints("https://full-node.testnet-1.coreum.dev:26657");
    expect(endpoints).toContain("https://full-node.testnet-1.coreum.dev:1317");
  });
});

describe("getActiveProposals: P0", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns proposals via gov v1 REST when the v1beta1 query throws (Coreum shape)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(restResponse([v1Proposal("46", "PROPOSAL_STATUS_VOTING_PERIOD")]));

    const proposals = await getActiveProposals(throwingQueryClient, RPC, REST);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].proposalId.toString()).toBe("46");
    // The first endpoint tried must be the configured restEndpoint, not the RPC URL
    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toContain("rest-01.mainnet-1.tx.org");
    expect(firstUrl).toContain("proposal_status=2");
  });

  it("treats a valid empty REST answer as authoritative (zero proposals, not an error)", async () => {
    global.fetch = jest.fn().mockResolvedValue(restResponse([]));

    const proposals = await getActiveProposals(throwingQueryClient, RPC, REST);

    expect(proposals).toEqual([]);
    // An authoritative empty answer stops the endpoint walk
    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  });

  it("returns [] when every REST candidate fails too", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const proposals = await getActiveProposals(throwingQueryClient, RPC, REST);

    expect(proposals).toEqual([]);
  });
});

describe("getPastProposals: P0", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns only finished proposals, filtering on the RAW v1 status", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      restResponse([
        v1Proposal("46", "PROPOSAL_STATUS_VOTING_PERIOD"),
        v1Proposal("45", "PROPOSAL_STATUS_PASSED"),
        v1Proposal("44", "PROPOSAL_STATUS_REJECTED"),
        v1Proposal("43", "PROPOSAL_STATUS_FAILED"),
        // Deposit-period must not leak in: the converter maps unknown raw
        // statuses to 2 (voting), so a post-conversion filter would misfile it.
        v1Proposal("42", "PROPOSAL_STATUS_DEPOSIT_PERIOD"),
      ]),
    );

    const past = await getPastProposals(RPC, REST);

    expect(past).not.toBeNull();
    expect(past!.map((p) => p.proposalId.toString())).toEqual(["45", "44", "43"]);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("pagination.reverse=true");
  });

  it("returns null (history unavailable) when no endpoint answers, not an empty list", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const past = await getPastProposals(RPC, REST);

    expect(past).toBeNull();
  });
});
