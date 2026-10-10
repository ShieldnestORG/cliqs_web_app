/**
 * Validator Stakers Fetch Test
 *
 * File: __tests__/lib/validator-stakers-fetch.test.ts
 *
 * getValidatorDelegations / getValidatorUnbondingDelegations keep two different answers apart
 * (since 2026-10-10), the same contract as getPastProposals:
 *   - a query that throws          -> null  (the fetch failed: the page says "unavailable")
 *   - a real answer with no rows   -> []    (nobody stakes here / nothing is unbonding)
 * Until then both came back as [], so a failed fetch read "0 stakers" on a validator whose
 * Performance tile said 645 (seen on the real page).
 *
 * Priority: P1
 */

import { getValidatorDelegations, getValidatorUnbondingDelegations } from "@/lib/validatorHelpers";

const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";

const delegation = (delegator: string, amount: string) => ({
  delegation: { delegatorAddress: delegator },
  balance: { amount },
});

const clientWith = (staking: Record<string, unknown>) => ({ staking }) as never;

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getValidatorDelegations: null on failure, [] on none: P1", () => {
  it("returns null when the query throws", async () => {
    const queryClient = clientWith({
      validatorDelegations: jest.fn().mockRejectedValue(new Error("rpc down")),
    });

    await expect(getValidatorDelegations(queryClient, VALOPER)).resolves.toBeNull();
  });

  it("returns null when a LATER page throws (no half list passed off as the whole)", async () => {
    const validatorDelegations = jest
      .fn()
      .mockResolvedValueOnce({
        delegationResponses: [delegation("testcore1a", "5")],
        pagination: { nextKey: new Uint8Array([1]) },
      })
      .mockRejectedValueOnce(new Error("page 2 failed"));

    const result = await getValidatorDelegations(clientWith({ validatorDelegations }), VALOPER);

    expect(result).toBeNull();
    expect(validatorDelegations).toHaveBeenCalledTimes(2);
  });

  it("returns [] when the chain really answers with no delegations", async () => {
    const queryClient = clientWith({
      validatorDelegations: jest
        .fn()
        .mockResolvedValue({ delegationResponses: [], pagination: undefined }),
    });

    const result = await getValidatorDelegations(queryClient, VALOPER);

    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });

  it("still pages through every page and sorts largest first", async () => {
    const validatorDelegations = jest
      .fn()
      .mockResolvedValueOnce({
        delegationResponses: [delegation("testcore1a", "5"), delegation("testcore1b", "50")],
        pagination: { nextKey: new Uint8Array([1]) },
      })
      .mockResolvedValueOnce({
        delegationResponses: [delegation("testcore1c", "500")],
        pagination: { nextKey: new Uint8Array() },
      });

    const result = await getValidatorDelegations(clientWith({ validatorDelegations }), VALOPER);

    expect(result?.map((d) => d.delegation?.delegatorAddress)).toEqual([
      "testcore1c",
      "testcore1b",
      "testcore1a",
    ]);
  });
});

describe("getValidatorUnbondingDelegations: null on failure, [] on none: P1", () => {
  it("returns null when the query throws", async () => {
    const queryClient = clientWith({
      validatorUnbondingDelegations: jest.fn().mockRejectedValue(new Error("rpc down")),
    });

    await expect(getValidatorUnbondingDelegations(queryClient, VALOPER)).resolves.toBeNull();
  });

  it("returns [] when the chain really answers with nothing unbonding", async () => {
    const queryClient = clientWith({
      validatorUnbondingDelegations: jest
        .fn()
        .mockResolvedValue({ unbondingResponses: [], pagination: undefined }),
    });

    const result = await getValidatorUnbondingDelegations(queryClient, VALOPER);

    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });

  it("returns the unbonding rows it was given", async () => {
    const row = { delegatorAddress: "testcore1leaver", entries: [] };
    const queryClient = clientWith({
      validatorUnbondingDelegations: jest
        .fn()
        .mockResolvedValue({ unbondingResponses: [row], pagination: undefined }),
    });

    await expect(getValidatorUnbondingDelegations(queryClient, VALOPER)).resolves.toEqual([row]);
  });
});
