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
 * The TITLE (2026-10-10): the v1beta1 view of a proposal whose message is not a legacy-content
 * wrapper has no title (proposal #47 on TX mainnet, "TX Chain Mainnet Upgrade v8.0.0", one
 * MsgSoftwareUpgrade: v1beta1 `content` keys are `@type, authority, plan`; the title is only in
 * gov v1). The LIST of active proposals is what it always was, because it drives the Vote Now
 * buttons: the v1beta1 query first, the gov v1 REST list only when v1beta1 throws or returns
 * nothing. gov v1 only supplies titles: asked once when a listed proposal has none, and its title
 * is copied onto the proposal with the same id. REST can never add, remove or reorder a proposal
 * when v1beta1 answered, so a REST node that answers [] cannot hide a proposal and a REST host
 * that ignores proposal_status=2 cannot put a finished one on the page. In the REST-list path
 * only a proposal whose RAW status is the voting period is kept.
 *
 * Priority: P0
 */

import {
  deriveRestEndpoints,
  getActiveProposals,
  getPastProposals,
  readProposalTitle,
} from "@/lib/validatorHelpers";

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

// The shape of proposal 47 as the v1beta1 query returns it on TX mainnet: no title anywhere.
const v1beta1Proposal47 = {
  proposalId: BigInt(47),
  status: 2,
  content: {
    typeUrl: "/cosmos.gov.v1.MsgSoftwareUpgrade",
    value: new Uint8Array([1, 2, 3]),
  },
  votingStartTime: { seconds: BigInt(1_790_000_000), nanos: 123 },
  votingEndTime: { seconds: BigInt(1_790_172_800), nanos: 456 },
};

const queryClientAnswering = (proposals: unknown[]) =>
  ({ gov: { proposals: jest.fn().mockResolvedValue({ proposals }) } }) as any;

describe("getActiveProposals: the list is v1beta1's, gov v1 only supplies titles: P0", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  const v1Active = (id: string, title: string) => ({
    ...v1Proposal(id, "PROPOSAL_STATUS_VOTING_PERIOD"),
    title,
  });

  it("lists 47 with the fallback title when REST answers [] and v1beta1 knows it", async () => {
    global.fetch = jest.fn().mockResolvedValue(restResponse([]));
    const queryClient = queryClientAnswering([v1beta1Proposal47]);

    const proposals = await getActiveProposals(queryClient, RPC, REST);

    expect(proposals).toEqual([v1beta1Proposal47]);
    expect(readProposalTitle(proposals[0])).toBeNull(); // the page then says "Proposal #47"
  });

  it("keeps only 47, with REST's title, when REST also returns 46 (passed) and v1beta1 lists 47", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        restResponse([
          v1Proposal("46", "PROPOSAL_STATUS_PASSED"),
          v1Active("47", "TX Chain Mainnet Upgrade v8.0.0"),
        ]),
      );
    const queryClient = queryClientAnswering([v1beta1Proposal47]);

    const proposals = await getActiveProposals(queryClient, RPC, REST);

    expect(proposals).toHaveLength(1);
    expect(proposals[0].proposalId).toBe(BigInt(47));
    expect(readProposalTitle(proposals[0])).toBe("TX Chain Mainnet Upgrade v8.0.0");
  });

  it("never adds a proposal REST knows and v1beta1 does not, even a voting-period one", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        restResponse([v1Active("48", "Only REST knows me"), v1Active("47", "Seen by both")]),
      );
    const queryClient = queryClientAnswering([v1beta1Proposal47]);

    const proposals = await getActiveProposals(queryClient, RPC, REST);

    expect(proposals.map((p) => p.proposalId)).toEqual([BigInt(47)]);
  });

  it("keeps v1beta1's order, whatever order REST answers in", async () => {
    const v1beta1Proposal46 = { ...v1beta1Proposal47, proposalId: BigInt(46) };
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        restResponse([v1Active("46", "Forty-six"), v1Active("47", "Forty-seven")]),
      );
    const queryClient = queryClientAnswering([v1beta1Proposal47, v1beta1Proposal46]);

    const proposals = await getActiveProposals(queryClient, RPC, REST);

    expect(proposals.map((p) => p.proposalId)).toEqual([BigInt(47), BigInt(46)]);
    expect(proposals.map(readProposalTitle)).toEqual(["Forty-seven", "Forty-six"]);
  });

  it("copies only a title onto the proposal: id, status and voting times are v1beta1's own", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      restResponse([
        {
          ...v1Active("47", "TX Chain Mainnet Upgrade v8.0.0"),
          // REST says other times: they must not replace what v1beta1 listed
          voting_start_time: "2001-01-01T00:00:00Z",
          voting_end_time: "2001-01-02T00:00:00Z",
        },
      ]),
    );
    const queryClient = queryClientAnswering([v1beta1Proposal47]);

    const [proposal] = await getActiveProposals(queryClient, RPC, REST);

    expect(proposal.proposalId).toBe(v1beta1Proposal47.proposalId);
    expect(proposal.status).toBe(v1beta1Proposal47.status);
    expect(proposal.votingStartTime).toBe(v1beta1Proposal47.votingStartTime);
    expect(proposal.votingEndTime).toBe(v1beta1Proposal47.votingEndTime);
    expect((proposal.content as { typeUrl: string }).typeUrl).toBe(
      "/cosmos.gov.v1.MsgSoftwareUpgrade",
    );
  });

  it("asks REST once for the whole list, and not at all when every proposal has a title", async () => {
    const v1beta1Proposal46 = { ...v1beta1Proposal47, proposalId: BigInt(46) };
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        restResponse([v1Active("46", "Forty-six"), v1Active("47", "Forty-seven")]),
      );
    await getActiveProposals(
      queryClientAnswering([v1beta1Proposal47, v1beta1Proposal46]),
      RPC,
      REST,
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);

    global.fetch = jest.fn();
    const titled = { ...v1beta1Proposal47, content: { title: "Already titled" } };
    const proposals = await getActiveProposals(queryClientAnswering([titled]), RPC, REST);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(proposals).toEqual([titled]);
  });

  it("keeps the title v1beta1 already has, and ignores a blank REST title", async () => {
    const titled = { ...v1beta1Proposal47, content: { title: "Mine" } };
    const untitled = { ...v1beta1Proposal47, proposalId: BigInt(48) };
    global.fetch = jest
      .fn()
      .mockResolvedValue(restResponse([v1Active("47", "Theirs"), v1Active("48", "   ")]));

    const proposals = await getActiveProposals(queryClientAnswering([titled, untitled]), RPC, REST);

    expect(proposals.map(readProposalTitle)).toEqual(["Mine", null]);
  });

  it("keeps the list and the fallback title when REST is unreachable or throws", async () => {
    for (const fetchImpl of [
      jest.fn().mockResolvedValue({ ok: false }),
      jest.fn().mockRejectedValue(new Error("network down")),
    ]) {
      global.fetch = fetchImpl;
      const queryClient = queryClientAnswering([v1beta1Proposal47]);

      const proposals = await getActiveProposals(queryClient, RPC, REST);

      expect(proposals).toEqual([v1beta1Proposal47]);
    }
  });

  it("keeps the list when the REST answer holds a malformed entry", async () => {
    global.fetch = jest.fn().mockResolvedValue(restResponse([null]));
    const queryClient = queryClientAnswering([v1beta1Proposal47]);

    const proposals = await getActiveProposals(queryClient, RPC, REST);

    expect(proposals).toEqual([v1beta1Proposal47]);
  });

  it("uses the REST list, voting period only, when the v1beta1 query throws", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        restResponse([
          v1Active("46", "Forty-six"),
          v1Proposal("45", "PROPOSAL_STATUS_PASSED"),
          v1Proposal("44", "PROPOSAL_STATUS_DEPOSIT_PERIOD"),
        ]),
      );

    const proposals = await getActiveProposals(throwingQueryClient, RPC, REST);

    expect(proposals.map((p) => p.proposalId)).toEqual([BigInt(46)]);
    expect(proposals.map((p) => p.status)).toEqual([2]);
    expect(readProposalTitle(proposals[0])).toBe("Forty-six");
  });

  it("uses the REST list, voting period only, when v1beta1 answers with nothing", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        restResponse([v1Proposal("45", "PROPOSAL_STATUS_REJECTED"), v1Active("46", "Forty-six")]),
      );

    const proposals = await getActiveProposals(queryClientAnswering([]), RPC, REST);

    expect(proposals.map((p) => p.proposalId)).toEqual([BigInt(46)]);
  });

  it("returns [] when v1beta1 answers with nothing and REST is down", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await expect(getActiveProposals(queryClientAnswering([]), RPC, REST)).resolves.toEqual([]);
  });

  it("returns [] when REST is unreachable and the v1beta1 query throws too", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    await expect(getActiveProposals(throwingQueryClient, RPC, REST)).resolves.toEqual([]);
  });

  it("gives the id, status and voting-end seconds a listed proposal always had", async () => {
    // the same answers, as the v1beta1 query gives them and as the REST list gives them
    const endSeconds = BigInt(1_790_172_800);
    global.fetch = jest.fn().mockResolvedValue(
      restResponse([
        {
          ...v1Active("47", "TX Chain Mainnet Upgrade v8.0.0"),
          voting_end_time: new Date(Number(endSeconds) * 1000).toISOString(),
        },
      ]),
    );

    const [viaList] = await getActiveProposals(queryClientAnswering([]), RPC, REST);
    const [viaTitles] = await getActiveProposals(
      queryClientAnswering([v1beta1Proposal47]),
      RPC,
      REST,
    );

    for (const proposal of [viaList, viaTitles]) {
      expect(proposal.proposalId).toBe(BigInt(47));
      expect(proposal.status).toBe(2);
      expect(proposal.votingEndTime?.seconds).toBe(endSeconds);
    }
  });
});

describe("readProposalTitle: P0", () => {
  const withContent = (content: unknown) =>
    ({ proposalId: BigInt(1), status: 2, content }) as never;

  it.each([
    ["content.title", { title: "A title" }, "A title"],
    ["content.value.title (a decoded Any)", { value: { title: "Inner" } }, "Inner"],
    ["content.title over content.value.title", { title: "Own", value: { title: "Inner" } }, "Own"],
    [
      "content.value.title after a blank content.title",
      { title: " ", value: { title: "Inner" } },
      "Inner",
    ],
  ])("reads %s", (_name, content, expected) => {
    expect(readProposalTitle(withContent(content))).toBe(expected);
  });

  it.each([
    ["no content", undefined],
    ["null content", null],
    ["an empty title", { title: "" }],
    ["a blank title", { title: "   " }],
    ["a non-text title", { title: 42 }],
    ["a non-text value.title", { value: { title: { text: "nested" } } }],
    ["an Any with raw bytes", { typeUrl: "/x", value: new Uint8Array([1, 2, 3]) }],
  ])("says null for %s", (_name, content) => {
    expect(readProposalTitle(withContent(content))).toBeNull();
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
