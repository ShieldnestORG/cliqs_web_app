/**
 * Unjail Action Test
 *
 * File: __tests__/components/unjail-action.test.tsx
 *
 * The "Unjail validator" action on the validator dashboard:
 *   - hidden unless the validator is jailed
 *   - disabled (with the reason) when tombstoned or still inside the jail period
 *   - enabled otherwise, with the "only after your node is synced" warning
 *   - multisig operator: creates a CLIQ transaction and navigates to the signing page
 *   - single-wallet operator: signs and broadcasts with the connected wallet
 *
 * Nothing here touches a chain: the CLIQ transaction creator and the signing client are
 * mocked. In the single-wallet test the mock client signs OFFLINE with a throwaway key
 * (so the registry the component supplies is really exercised) and never broadcasts.
 *
 * Priority: P0
 */

// jest.setup.js stubs these cosmjs packages (no bech32, no wallets, no coins()). These tests need
// the real encoding and offline signing, so they opt out of the stubs.
jest.unmock("@cosmjs/encoding");
jest.unmock("@cosmjs/proto-signing");
jest.unmock("@cosmjs/amino");

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UnjailAction from "@/components/dataViews/ValidatorDashboard/UnjailAction";
import { ValidatorInfo, ValidatorSigningInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction } from "@/lib/validatorTx";
import { formatJailedUntil } from "@/lib/validatorUnjail";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { randomBytes } from "crypto";
import { toast } from "sonner";

const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";
const OPERATOR_ACCOUNT = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";
const CLIQ = OPERATOR_ACCOUNT; // the validator's operator account IS the CLIQ in CLIQ mode
const HOUR = 3_600_000;

const mockPush = jest.fn();
jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush, query: {}, pathname: "/tx/validator" }),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    loading: jest.fn(() => "loading-toast"),
    dismiss: jest.fn(),
  },
}));

jest.mock("@/context/ChainsContext", () => ({
  useChains: () => ({
    chain: {
      registryName: "tx",
      chainId: "coreum-testnet-1",
      chainDisplayName: "TX",
      addressPrefix: "testcore",
      nodeAddress: "https://rpc.invalid:26657",
      denom: "utestcore",
      gasPrice: "0.0625utestcore",
      explorerLinks: { tx: "https://explorer.invalid/tx/${txHash}", account: "" },
    },
  }),
}));

let mockWalletInfo: { address: string } | null = { address: OPERATOR_ACCOUNT };
const mockGetDirectSigner = jest.fn();
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({ walletInfo: mockWalletInfo, getDirectSigner: mockGetDirectSigner }),
}));

// Keep the real buildUnjailMsg; replace only the part that writes to the database.
jest.mock("@/lib/validatorTx", () => ({
  ...jest.requireActual("@/lib/validatorTx"),
  createCliqTransaction: jest.fn(),
}));

const validator = (over: Partial<ValidatorInfo> = {}): ValidatorInfo => ({
  operatorAddress: VALOPER,
  delegatorAddress: OPERATOR_ACCOUNT,
  moniker: "Tokns.fi",
  identity: "",
  website: "",
  securityContact: "",
  details: "",
  commissionRate: "0.1",
  maxCommissionRate: "0.2",
  maxCommissionChangeRate: "0.01",
  minSelfDelegation: "20000000000",
  jailed: true,
  status: "UNBONDING",
  tokens: "0",
  delegatorShares: "0",
  ...over,
});

const signingInfo = (over: Partial<ValidatorSigningInfo> = {}): ValidatorSigningInfo => ({
  missedBlocksCounter: BigInt(0),
  jailedUntil: new Date(Date.now() - 2 * HOUR),
  tombstoned: false,
  startHeight: BigInt(1),
  ...over,
});

const getButton = () => screen.getByRole("button", { name: /unjail validator/i });

beforeEach(() => {
  jest.clearAllMocks();
  mockWalletInfo = { address: OPERATOR_ACCOUNT };
});

afterEach(() => {
  jest.restoreAllMocks(); // drop the connectWithSigner spies between tests
});

describe("UnjailAction visibility and gating: P0", () => {
  it("renders nothing when the validator is not jailed", () => {
    const { container } = render(
      <UnjailAction validator={validator({ jailed: false })} signingInfo={signingInfo()} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is enabled when jailed and the jail period has passed, with the sync warning", () => {
    render(<UnjailAction validator={validator()} signingInfo={signingInfo()} />);
    expect(getButton()).toBeEnabled();
    expect(screen.getByText(/synced and signing again/i)).toBeInTheDocument();
  });

  it("is disabled and shows the time while jailed_until is in the future", () => {
    const until = new Date(Date.now() + 2 * HOUR);
    render(
      <UnjailAction validator={validator()} signingInfo={signingInfo({ jailedUntil: until })} />,
    );
    expect(getButton()).toBeDisabled();
    expect(screen.getByText(new RegExp(formatJailedUntil(until)))).toBeInTheDocument();
  });

  it("is disabled and says it can never be unjailed when tombstoned", () => {
    render(
      <UnjailAction validator={validator()} signingInfo={signingInfo({ tombstoned: true })} />,
    );
    expect(getButton()).toBeDisabled();
    expect(screen.getByText(/can never be unjailed/i)).toBeInTheDocument();
  });

  it("stays enabled, with a notice, when the signing info could not be read", () => {
    render(<UnjailAction validator={validator()} signingInfo={null} />);
    expect(getButton()).toBeEnabled();
    expect(screen.getByText(/could not read/i)).toBeInTheDocument();
  });

  it("is disabled in read-only CLIQ mode", () => {
    render(
      <UnjailAction
        validator={validator()}
        signingInfo={signingInfo()}
        isCliqMode
        cliqAddress={CLIQ}
        readOnly
      />,
    );
    expect(getButton()).toBeDisabled();
  });

  it("does nothing when a disabled button is clicked", () => {
    render(
      <UnjailAction validator={validator()} signingInfo={signingInfo({ tombstoned: true })} />,
    );
    fireEvent.click(getButton());
    expect(createCliqTransaction).not.toHaveBeenCalled();
    expect(mockGetDirectSigner).not.toHaveBeenCalled();
  });
});

describe("UnjailAction multisig (CLIQ) operator: P0", () => {
  it("creates the CLIQ transaction and navigates to the signing page", async () => {
    (createCliqTransaction as jest.Mock).mockResolvedValue({ success: true, txId: "tx-123" });
    const connect = jest.spyOn(SigningStargateClient, "connectWithSigner");

    render(
      <UnjailAction
        validator={validator()}
        signingInfo={signingInfo()}
        isCliqMode
        cliqAddress={CLIQ}
      />,
    );
    fireEvent.click(getButton());

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/tx/${CLIQ}/transaction/tx-123`));
    expect(createCliqTransaction).toHaveBeenCalledTimes(1);
    const params = (createCliqTransaction as jest.Mock).mock.calls[0][0];
    expect(params.cliqAddress).toBe(CLIQ);
    expect(params.chain.chainId).toBe("coreum-testnet-1");
    expect(params.messages).toEqual([
      { typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail", value: { validatorAddr: VALOPER } },
    ]);
    expect(toast.success).toHaveBeenCalledWith("Transaction created!", expect.anything());
    expect(connect).not.toHaveBeenCalled(); // CLIQ mode never signs with the connected wallet
  });

  it("surfaces a failure and does not navigate", async () => {
    (createCliqTransaction as jest.Mock).mockResolvedValue({ success: false, error: "boom" });
    render(
      <UnjailAction
        validator={validator()}
        signingInfo={signingInfo()}
        isCliqMode
        cliqAddress={CLIQ}
      />,
    );
    fireEvent.click(getButton());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create transaction",
        expect.objectContaining({ description: "boom" }),
      ),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("asks to connect a wallet first", async () => {
    mockWalletInfo = null;
    render(
      <UnjailAction
        validator={validator()}
        signingInfo={signingInfo()}
        isCliqMode
        cliqAddress={CLIQ}
      />,
    );
    fireEvent.click(getButton());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Please connect your wallet first"),
    );
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });
});

describe("UnjailAction single-wallet operator: P0", () => {
  it("signs MsgUnjail with the connected wallet using the app registry, then refreshes", async () => {
    const signer = await DirectSecp256k1Wallet.fromKey(new Uint8Array(randomBytes(32)), "testcore");
    const [{ address: signerAddress }] = await signer.getAccounts();
    mockGetDirectSigner.mockResolvedValue(signer);

    const signed: { address: string; msgs: unknown; fee: unknown }[] = [];
    const connect = jest
      .spyOn(SigningStargateClient, "connectWithSigner")
      .mockImplementation(async (_url, offlineSigner, options) => {
        // Real encoding with the options the component passes, but no network and no broadcast.
        const offline = await SigningStargateClient.offline(offlineSigner, options);
        return {
          signAndBroadcast: async (address: string, msgs: never, fee: never, memo?: string) => {
            await offline.sign(address, msgs, fee, memo ?? "", {
              accountNumber: 0,
              sequence: 0,
              chainId: "coreum-testnet-1",
            });
            signed.push({ address, msgs, fee });
            return { code: 0, transactionHash: "TESTHASH", rawLog: "" };
          },
        } as unknown as SigningStargateClient;
      });
    const onTransactionComplete = jest.fn();

    render(
      <UnjailAction
        validator={validator({ delegatorAddress: signerAddress })}
        signingInfo={signingInfo()}
        onTransactionComplete={onTransactionComplete}
      />,
    );
    fireEvent.click(getButton());

    await waitFor(() => expect(onTransactionComplete).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
    expect(createCliqTransaction).not.toHaveBeenCalled();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(signed).toHaveLength(1);
    expect(signed[0].address).toBe(signerAddress); // signs as the validator's operator account
    expect(signed[0].msgs).toEqual([
      { typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail", value: { validatorAddr: VALOPER } },
    ]);
    // gasOfTx([Unjail]) = 300,000 at 0.0625utestcore
    expect(signed[0].fee).toEqual({
      amount: [{ denom: "utestcore", amount: "18750" }],
      gas: "300000",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Validator unjailed!",
      expect.objectContaining({ description: expect.stringContaining("TESTHASH") }),
    );
  });

  it("reports a failed broadcast and does not refresh", async () => {
    mockGetDirectSigner.mockResolvedValue({});
    jest.spyOn(SigningStargateClient, "connectWithSigner").mockResolvedValue({
      signAndBroadcast: async () => ({
        code: 5,
        transactionHash: "BAD",
        rawLog: "validator still jailed",
      }),
    } as unknown as SigningStargateClient);
    const onTransactionComplete = jest.fn();

    render(
      <UnjailAction
        validator={validator()}
        signingInfo={signingInfo()}
        onTransactionComplete={onTransactionComplete}
      />,
    );
    fireEvent.click(getButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to unjail validator",
        expect.objectContaining({ description: expect.stringContaining("validator still jailed") }),
      ),
    );
    expect(onTransactionComplete).not.toHaveBeenCalled();
  });
});
