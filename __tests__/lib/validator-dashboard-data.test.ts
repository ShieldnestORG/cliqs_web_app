/**
 * Validator Dashboard Data Test
 *
 * File: __tests__/lib/validator-dashboard-data.test.ts
 *
 * Runs the REAL getValidatorDashboardData against a stubbed query client (the network layer is
 * replaced; every helper in lib/validatorHelpers.ts is the real one) and pins the three counts the
 * Performance tile and the Stakers section read:
 *   - the staking queries throw      -> delegations, unbondingDelegations and delegatorsCount are
 *                                       all null (unavailable), never [] / [] / 0
 *   - the staking queries answer []  -> [] / [] / 0 (a real, measured "nobody stakes here")
 *   - the staking queries answer N   -> the list is passed through as it came (not replaced by
 *                                       `?? []`) and delegatorsCount is its length
 *   - one number, one fetch: the stakers count is the length of the list the page shows, so
 *     `validatorDelegations` is paged once per page, not once more to count
 *   - the voting power share is null when the pool query throws and a real figure otherwise
 *
 * Until 2026-10-10 a second full pagination counted the stakers and returned 0 when it failed, so
 * the Performance tile read "0 total" next to a Stakers section that said "unavailable".
 *
 * Priority: P1
 */

// jest.setup.js stubs @cosmjs/encoding; the address conversions need the real thing.
jest.unmock("@cosmjs/encoding");

// The network layer: connectComet answers a bare object and QueryClient.withExtensions hands back
// the stub below, so no socket is opened. Every function under test is the real one.
jest.mock("@cosmjs/tendermint-rpc", () => ({
  connectComet: jest.fn().mockResolvedValue({}),
}));
jest.mock("@cosmjs/stargate", () => ({
  ...jest.requireActual("@cosmjs/stargate"),
  QueryClient: { withExtensions: jest.fn() },
}));

import { QueryClient } from "@cosmjs/stargate";
import { getValidatorDashboardData } from "@/lib/validatorHelpers";

const RPC = "https://rpc.invalid:26657";
const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";
const OPERATOR_ACCOUNT = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";

const validatorProto = {
  operatorAddress: VALOPER,
  description: { moniker: "Tokns.fi" },
  commission: { commissionRates: { rate: "0.05", maxRate: "0.2", maxChangeRate: "0.01" } },
  minSelfDelegation: "1",
  jailed: false,
  status: 3,
  tokens: "1000",
  delegatorShares: "1000",
};

const delegation = (n: number) => ({
  delegation: { delegatorAddress: `testcore1staker${n}` },
  balance: { amount: String(n * 10) },
});
const unbonding = (n: number) => ({ delegatorAddress: `testcore1leaver${n}`, entries: [] });

type Fn = jest.Mock;

/** A query client whose staking queries are replaced by the given mocks. */
function stubClient(staking: { [name: string]: Fn }) {
  const client = {
    staking: {
      validator: jest.fn().mockResolvedValue({ validator: validatorProto }),
      validators: jest.fn().mockResolvedValue({ validators: [validatorProto] }),
      pool: jest.fn().mockResolvedValue({ pool: { bondedTokens: "100000" } }),
      validatorDelegations: jest.fn().mockResolvedValue({ delegationResponses: [] }),
      validatorUnbondingDelegations: jest.fn().mockResolvedValue({ unbondingResponses: [] }),
      ...staking,
    },
    distribution: {
      validatorCommission: jest.fn().mockResolvedValue({ commission: { commission: [] } }),
      delegationRewards: jest.fn().mockResolvedValue({ rewards: [] }),
      delegatorWithdrawAddress: jest.fn().mockResolvedValue({ withdrawAddress: OPERATOR_ACCOUNT }),
    },
    gov: {
      proposals: jest.fn().mockResolvedValue({ proposals: [] }),
      vote: jest.fn().mockRejectedValue(new Error("no vote")),
    },
  };
  (QueryClient.withExtensions as jest.Mock).mockReturnValue(client);
  return client;
}

const load = () => getValidatorDashboardData(RPC, OPERATOR_ACCOUNT, "testcore");

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  // no REST node answers: the proposal lists come from the stubbed v1beta1 query alone
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getValidatorDashboardData stakers counts: P1", () => {
  it("returns null, null and null when the staking queries throw", async () => {
    stubClient({
      validatorDelegations: jest.fn().mockRejectedValue(new Error("rpc down")),
      validatorUnbondingDelegations: jest.fn().mockRejectedValue(new Error("rpc down")),
    });

    const result = await load();

    expect(result).not.toBeNull();
    expect(result!.delegations).toBeNull();
    expect(result!.unbondingDelegations).toBeNull();
    expect(result!.delegatorsCount).toBeNull();
  });

  it("returns [], [] and 0 when the staking queries answer with nothing", async () => {
    stubClient({});

    const result = await load();

    expect(result!.delegations).toEqual([]);
    expect(result!.unbondingDelegations).toEqual([]);
    expect(result!.delegatorsCount).toBe(0);
  });

  it("passes the lists through and counts the stakers list it was given", async () => {
    stubClient({
      validatorDelegations: jest.fn().mockResolvedValue({
        delegationResponses: [delegation(1), delegation(2), delegation(3)],
      }),
      validatorUnbondingDelegations: jest.fn().mockResolvedValue({
        unbondingResponses: [unbonding(1), unbonding(2)],
      }),
    });

    const result = await load();

    expect(result!.delegations).toHaveLength(3);
    expect(result!.unbondingDelegations).toHaveLength(2);
    expect(result!.delegatorsCount).toBe(3);
    expect(result!.delegatorsCount).toBe(result!.delegations!.length);
  });

  it("keeps a failed stakers fetch apart from a loaded unbonding list, and the other way round", async () => {
    stubClient({
      validatorDelegations: jest.fn().mockRejectedValue(new Error("stakers down")),
      validatorUnbondingDelegations: jest.fn().mockResolvedValue({
        unbondingResponses: [unbonding(1)],
      }),
    });
    const stakersDown = await load();
    expect(stakersDown!.delegations).toBeNull();
    expect(stakersDown!.delegatorsCount).toBeNull();
    expect(stakersDown!.unbondingDelegations).toHaveLength(1);

    stubClient({
      validatorDelegations: jest.fn().mockResolvedValue({
        delegationResponses: [delegation(1), delegation(2)],
      }),
      validatorUnbondingDelegations: jest.fn().mockRejectedValue(new Error("unbonding down")),
    });
    const unbondingDown = await load();
    expect(unbondingDown!.delegations).toHaveLength(2);
    expect(unbondingDown!.delegatorsCount).toBe(2);
    expect(unbondingDown!.unbondingDelegations).toBeNull();
  });

  it("counts across pages, and pages the stakers query once per page (no second pass to count)", async () => {
    const validatorDelegations = jest
      .fn()
      .mockResolvedValueOnce({
        delegationResponses: [delegation(1), delegation(2)],
        pagination: { nextKey: new Uint8Array([1]) },
      })
      .mockResolvedValueOnce({
        delegationResponses: [delegation(3)],
        pagination: { nextKey: new Uint8Array() },
      });
    stubClient({ validatorDelegations });

    const result = await load();

    expect(result!.delegatorsCount).toBe(3);
    expect(result!.delegations).toHaveLength(3);
    expect(validatorDelegations).toHaveBeenCalledTimes(2);
  });
});

describe("getValidatorDashboardData voting power share: P1", () => {
  it("is null when the pool query throws", async () => {
    stubClient({ pool: jest.fn().mockRejectedValue(new Error("pool down")) });

    const result = await load();

    expect(result).not.toBeNull();
    expect(result!.votingPowerPercentage).toBeNull();
  });

  it("is null when the pool answer carries no bonded total", async () => {
    stubClient({ pool: jest.fn().mockResolvedValue({}) });

    const result = await load();

    expect(result).not.toBeNull();
    expect(result!.votingPowerPercentage).toBeNull();
  });

  it("is the validator's share of the bonded tokens when the pool answers", async () => {
    stubClient({}); // 1000 of 100000 bonded tokens

    const result = await load();

    expect(result!.votingPowerPercentage).toBe("1.00");
    expect(result!.ranking).toBe(1);
  });
});
