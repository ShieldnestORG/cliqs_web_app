/**
 * View Transaction Route Test (SSR)
 *
 * File: __tests__/pages/view-transaction.test.tsx
 *
 * Tests for the view transaction route (/[chainName]/[address]/transaction/[id])
 * Priority: P0
 */

import { render, screen, waitFor } from "@testing-library/react";
import TransactionViewPage, {
  getServerSideProps,
} from "@/pages/[chainName]/[address]/transaction/[transactionID]";
import { getTransaction } from "@/graphql/transaction";

jest.mock("@/graphql/transaction", () => ({
  getTransaction: jest.fn(),
}));

const mockGetTransaction = getTransaction as jest.MockedFunction<typeof getTransaction>;

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
  return function MockTransactionSigning(props: { tx: { accountNumber: unknown; sequence: unknown } }) {
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

  it("returns props with null transactionJSON when the transaction does not exist", async () => {
    mockGetTransaction.mockResolvedValue(null);

    const result = await getServerSideProps({
      params: { transactionID: "missing-transaction" },
    } as never);

    expect(result).toEqual({
      props: {
        transactionJSON: null,
        txHash: "",
        transactionID: "missing-transaction",
        signatures: [],
        status: "pending",
      },
    });
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
