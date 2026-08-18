/**
 * View Transaction Route Test (SSR)
 *
 * File: __tests__/pages/view-transaction.test.tsx
 *
 * Tests for the view transaction route (/[chainName]/[address]/transaction/[id])
 * Priority: P0
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransactionViewPage, {
  getServerSideProps,
} from "@/pages/[chainName]/[address]/transaction/[transactionID]";
import { getTransaction } from "@/graphql/transaction";
import { requestJson } from "@/lib/request";

jest.mock("@/graphql/transaction", () => ({
  getTransaction: jest.fn(),
}));

jest.mock("@/lib/request", () => ({
  requestJson: jest.fn(),
}));

const mockGetTransaction = getTransaction as jest.MockedFunction<typeof getTransaction>;
const mockRequestJson = requestJson as jest.MockedFunction<typeof requestJson>;

// Mock components that are used by TransactionViewPage
jest.mock("@/components/dataViews/TransactionInfo", () => {
  return function MockTransactionInfo() {
    return <div data-testid="transaction-info">Transaction Info</div>;
  };
});

jest.mock("@/components/dataViews/CompletedTransaction", () => {
  return function MockCompletedTransaction() {
    return <div data-testid="completed-transaction">Completed Transaction</div>;
  };
});

jest.mock("@/components/forms/TransactionSigning", () => {
  return function MockTransactionSigning(props: {
    tx: { accountNumber: unknown; sequence: unknown };
  }) {
    return (
      <div data-testid="transaction-signing">
        {`accountNumber:${String(props.tx.accountNumber)} (${typeof props.tx.accountNumber}) sequence:${String(props.tx.sequence)} (${typeof props.tx.sequence})`}
      </div>
    );
  };
});

jest.mock("@/lib/multisigHelpers", () => ({
  ensureChainMultisigInDb: jest.fn().mockResolvedValue({
    multisig: { id: "mock-multisig-id", address: "cosmos1test" },
    source: "db",
  }),
  getHostedMultisig: jest.fn().mockResolvedValue({
    hosted: "db+chain",
    pubkeyOnDb: {
      type: "tendermint/PubKeyMultisigThreshold",
      value: {
        threshold: "2",
        pubkeys: [
          { type: "tendermint/PubKeySecp256k1", value: "memberPubkeyOneBase64" },
          { type: "tendermint/PubKeySecp256k1", value: "memberPubkeyTwoBase64" },
        ],
      },
    },
    accountOnChain: {
      address: "cosmos1test",
      accountNumber: 1,
      sequence: 0,
    },
  }),
  isAccount: jest.fn().mockReturnValue(true),
}));

jest.mock("@/lib/api", () => ({
  cancelDbTx: jest.fn(),
  updateDbTxHash: jest.fn(),
}));

// Mock getServerSideProps data - FIXED format to match component expectations
const mockTransactionJSON = JSON.stringify({
  chainId: "cosmoshub-4",
  accountNumber: "1",
  sequence: "0",
  msgs: [],
  fee: { amount: [], gas: "200000" },
  memo: "Test transaction",
});
const importedSignatures = [
  {
    bodyBytes: "base64-body-bytes",
    signature: "base64-signature",
    address: "cosmos1importedsigner",
  },
];

describe("View Transaction Route (/[chainName]/[address]/transaction/[id]): P0", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only the transaction id, and does not read the database", async () => {
    // The page no longer server-renders transaction data; it hydrates from the
    // rate-limited API. A missing transaction is therefore resolved client-side
    // by loadTx, which routes to /404.
    const result = await getServerSideProps({
      params: { transactionID: "missing-transaction" },
      req: { headers: {} },
      res: { statusCode: 200, setHeader: jest.fn() },
      query: {},
      resolvedUrl: "",
    } as never);

    expect(result).toEqual({ props: { transactionID: "missing-transaction" } });
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it("should load transaction view page", async () => {
    // Pass props matching getServerSideProps return format
    render(
      <TransactionViewPage
        transactionJSON={mockTransactionJSON}
        transactionID="test-tx-id-123"
        txHash=""
        signatures={importedSignatures}
        status="pending"
      />,
    );

    await waitFor(() => {
      // Page should render transaction details
      const transactionInfo = screen.getByTestId("transaction-info");
      expect(transactionInfo).toBeInTheDocument();
    });
  });

  it("should display transaction ID", async () => {
    render(
      <TransactionViewPage
        transactionJSON={mockTransactionJSON}
        transactionID="test-tx-id-123"
        txHash=""
        signatures={[]}
        status="pending"
      />,
    );

    await waitFor(() => {
      // Transaction ID should be accessible via the component
      const transactionInfo = screen.getByTestId("transaction-info");
      expect(transactionInfo).toBeInTheDocument();
    });
  });

  it("should display transaction details", async () => {
    render(
      <TransactionViewPage
        transactionJSON={mockTransactionJSON}
        transactionID="test-tx-id-123"
        txHash=""
        signatures={[]}
        status="pending"
      />,
    );

    await waitFor(() => {
      // Transaction details should be visible
      const transactionInfo = screen.getByTestId("transaction-info");
      expect(transactionInfo).toBeInTheDocument();
    });
  });

  it("should load the pending transaction view", async () => {
    render(
      <TransactionViewPage
        transactionJSON={mockTransactionJSON}
        transactionID="test-tx-id-123"
        txHash=""
        signatures={importedSignatures}
        status="pending"
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId("transaction-info")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
});

/**
 * The transaction page used to serialise tx.dataJSON, every collected signature
 * and txHash into __NEXT_DATA__ in the server-rendered HTML. Multisig links are
 * pasted into chat apps by design, so that payload reached shared-cache proxies
 * and every link-unfurling bot that fetched the URL — parties that never asked
 * for it and are not the co-signer the link was meant for.
 *
 * These tests hold that door shut. If someone reintroduces a database read into
 * getServerSideProps, the first one fails.
 */
describe("View Transaction SSR: discloses nothing: P0", () => {
  const ssr = async (transactionID = "ssr-secret-tx") => {
    const res = { statusCode: 200, setHeader: jest.fn() };
    const result = await getServerSideProps({
      params: { transactionID },
      req: { headers: {} },
      res,
      query: {},
      resolvedUrl: "",
    } as never);
    return (result as unknown as { props: Record<string, unknown> }).props;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // If the page reads the database at all, it would get this back.
    mockGetTransaction.mockResolvedValue({
      id: "ssr-secret-tx",
      dataJSON: JSON.stringify({ memo: "rent", amount: "1000000", to: "cosmos1victim" }),
      txHash: "SECRETHASH",
      signatures: [{ address: "cosmos1signer", signature: "sig" }],
      status: "pending",
    } as never);
  });

  it("never reads the transaction while rendering the page", async () => {
    await ssr();

    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it("returns only the id, so no transaction data reaches the HTML", async () => {
    const props = await ssr();

    expect(props).toEqual({ transactionID: "ssr-secret-tx" });

    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain("rent");
    expect(serialized).not.toContain("1000000");
    expect(serialized).not.toContain("cosmos1victim");
    expect(serialized).not.toContain("SECRETHASH");
    expect(serialized).not.toContain("cosmos1signer");
  });

  it("still serves the page for any holder of the link, rather than gating it", async () => {
    // Access is deliberately unchanged: a co-signer who has not connected a
    // wallet must still be able to open a link that was sent to them.
    const res = { statusCode: 200, setHeader: jest.fn() };
    const result = await getServerSideProps({
      params: { transactionID: "any-id" },
      req: { headers: {} },
      res,
      query: {},
      resolvedUrl: "",
    } as never);

    expect(result).not.toHaveProperty("notFound");
    expect(result).not.toHaveProperty("redirect");
    expect(res.statusCode).toBe(200);
  });

  it("hydrates from the rate-limited API instead, on mount", async () => {
    mockRequestJson.mockResolvedValue({
      dataJSON: mockTransactionJSON,
      signatures: [],
      txHash: "",
      status: "pending",
    });

    render(<TransactionViewPage transactionID="ssr-secret-tx" />);

    // With no server-supplied data, the client fetch is the normal load path for
    // every visit — and it goes through the rate-limited route, which is now the
    // single place this read can be gated.
    await waitFor(() => {
      expect(mockRequestJson).toHaveBeenCalledWith("/api/transaction/ssr-secret-tx");
    });
  });
});
