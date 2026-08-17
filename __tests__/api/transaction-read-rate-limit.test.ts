/**
 * Transaction Read Rate Limit — regression tests
 *
 * File: __tests__/api/transaction-read-rate-limit.test.ts
 *
 * These lock in one invariant: the read budget must never be able to refuse a
 * write on /api/transaction/[transactionID].
 *
 * An earlier revision of this route called checkRateLimit above the method
 * branch, so GET and both POST actions drew on one 30/min/IP budget. POST
 * carries updateDbTxHash, which runs immediately after a transaction is already
 * on chain. lib/request.ts turns a 429 into a rejected promise, so a throttled
 * write left the row status=pending with an empty txHash while the funds had
 * moved — the operator then sees a generic broadcast failure and is steered
 * toward cancel-and-recreate, which double-executes a MsgSend.
 *
 * If someone hoists the limit back above the branch, the first test here fails.
 */

// @ts-ignore - node-mocks-http types may not be available
import { createMocks } from "node-mocks-http";
import apiTransactionActions from "@/pages/api/transaction/[transactionID]/index";
import { TRANSACTION_READ_LIMIT, resetRateLimits } from "@/lib/rateLimit";

jest.mock("@/graphql/transaction", () => ({
  getTransaction: jest.fn(),
  cancelTransaction: jest.fn(),
  updateTxHash: jest.fn(),
}));

import { getTransaction, cancelTransaction, updateTxHash } from "@/graphql/transaction";

const mockGetTransaction = getTransaction as jest.MockedFunction<typeof getTransaction>;
const mockCancelTransaction = cancelTransaction as jest.MockedFunction<typeof cancelTransaction>;
const mockUpdateTxHash = updateTxHash as jest.MockedFunction<typeof updateTxHash>;

const txId = "tx-rate-limit-1";
const CALLER_IP = "203.0.113.7";

/** One request from a fixed IP so every call lands in the same budget bucket. */
const call = async (
  method: "GET" | "POST",
  body?: Record<string, unknown>,
): Promise<{ status: number }> => {
  const { req, res } = createMocks({
    method,
    query: { transactionID: txId },
    headers: { "x-forwarded-for": CALLER_IP },
    ...(body ? { body } : {}),
  });

  await apiTransactionActions(req, res);
  return { status: res._getStatusCode() };
};

/** Burn the whole read budget from CALLER_IP. */
const exhaustReadBudget = async (): Promise<void> => {
  for (let i = 0; i < TRANSACTION_READ_LIMIT.limit; i++) {
    await call("GET");
  }
};

describe("transaction read rate limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();

    mockGetTransaction.mockResolvedValue({
      id: txId,
      dataJSON: JSON.stringify({ chainId: "cosmoshub-4", msgs: [] }),
      signatures: [],
    } as never);
    mockCancelTransaction.mockResolvedValue(undefined as never);
    mockUpdateTxHash.mockResolvedValue(undefined as never);
  });

  it("never throttles the post-broadcast hash write, even with the read budget fully spent", async () => {
    await exhaustReadBudget();

    // Control: reads are now refused, proving the budget really is exhausted.
    expect((await call("GET")).status).toBe(429);

    // The invariant. This is the write that runs after the funds have moved.
    const write = await call("POST", { txHash: "ABCDEF0123456789" });

    expect(write.status).not.toBe(429);
    expect(write.status).toBe(200);
    expect(mockUpdateTxHash).toHaveBeenCalledWith(txId, "ABCDEF0123456789");
  });

  it("never throttles cancel, even with the read budget fully spent", async () => {
    await exhaustReadBudget();
    expect((await call("GET")).status).toBe(429);

    const cancel = await call("POST", { action: "cancel" });

    expect(cancel.status).not.toBe(429);
    expect(cancel.status).toBe(200);
    expect(mockCancelTransaction).toHaveBeenCalledWith(txId);
  });

  it("allows reads up to the limit and refuses the one after it", async () => {
    for (let i = 0; i < TRANSACTION_READ_LIMIT.limit; i++) {
      expect((await call("GET")).status).toBe(200);
    }

    expect((await call("GET")).status).toBe(429);
  });

  it("budgets each caller separately", async () => {
    await exhaustReadBudget();
    expect((await call("GET")).status).toBe(429);

    const { req, res } = createMocks({
      method: "GET",
      query: { transactionID: txId },
      headers: { "x-forwarded-for": "198.51.100.42" },
    });
    await apiTransactionActions(req, res);

    expect(res._getStatusCode()).toBe(200);
  });

  it("charges writes nothing, so any number of them leaves reads untouched", async () => {
    for (let i = 0; i < 200; i++) {
      expect((await call("POST", { txHash: `HASH${i}` })).status).toBe(200);
    }

    // A read still succeeds: the 200 writes above consumed no read budget.
    expect((await call("GET")).status).toBe(200);
  });
});
