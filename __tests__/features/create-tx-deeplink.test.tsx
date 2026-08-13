/**
 * Create-Transaction Deep Link Test
 *
 * File: __tests__/features/create-tx-deeplink.test.tsx
 *
 * The validator dashboard links to the new-transaction page with
 * ?type=<MsgTypeUrl>. Without that being honoured, an operator who clicked
 * "Undelegate" has to pick "Undelegate" all over again from the command grid.
 * Priority: P1
 */

import { render, screen, waitFor } from "@testing-library/react";
import { MsgTypeUrls } from "@/types/txMsg";

// jest.setup.js mocks next/router with only useRouter. OldCreateTxForm is wrapped
// in withRouter, so provide it here as a passthrough and inject router directly.
jest.mock("next/router", () => ({
  withRouter: (Component: unknown) => Component,
  useRouter: () => ({ query: {}, isReady: true, push: jest.fn(), replace: jest.fn() }),
}));

// jest.setup.js's ChainsContext/helpers mock omits loadValidators, which the
// staking message types call. Re-declare the mock here including it.
jest.mock("@/context/ChainsContext/helpers", () => ({
  loadValidators: jest.fn(),
  isChainInfoFilled: () => true,
  emptyChain: {},
  setChain: jest.fn(),
  setChains: jest.fn(),
  setChainsError: jest.fn(),
}));

// The message forms pull in heavy chain machinery; stub them down to something
// that simply reports which message type it was asked to render.
jest.mock("@/components/forms/OldCreateTxForm/MsgForm", () => ({
  __esModule: true,
  default: ({ msgType }: { msgType: string }) => <div data-testid="msg-form">{msgType}</div>,
}));

import type { ComponentType } from "react";
import type { Account } from "@cosmjs/stargate";
import type { NextRouter } from "next/router";
import OldCreateTxForm from "@/components/forms/OldCreateTxForm";

// withRouter normally injects `router`, so the exported type omits it. The mock
// above makes withRouter a passthrough, so the test supplies router itself —
// this alias states that arrangement once instead of casting at each call site.
type DeepLinkFormProps = {
  readonly router: Pick<NextRouter, "query" | "isReady" | "push" | "replace">;
  readonly senderAddress: string;
  readonly accountOnChain: Account;
};

const CreateTxForm = OldCreateTxForm as unknown as ComponentType<DeepLinkFormProps>;

const accountOnChain: Account = {
  address: "cosmos1multisig",
  accountNumber: 1,
  sequence: 0,
  pubkey: null,
};

function renderWithQuery(query: Record<string, string>) {
  const router: DeepLinkFormProps["router"] = {
    query,
    isReady: true,
    push: jest.fn(),
    replace: jest.fn(),
  };

  return render(
    <CreateTxForm
      router={router}
      senderAddress="cosmos1multisig"
      accountOnChain={accountOnChain}
    />,
  );
}

describe("Create transaction deep link: P1", () => {
  it("preselects the message type passed in ?type", async () => {
    renderWithQuery({ type: MsgTypeUrls.Undelegate });

    await waitFor(() => {
      expect(screen.getByTestId("msg-form")).toHaveTextContent(MsgTypeUrls.Undelegate);
    });
  });

  it("preselects Delegate independently, so the param is actually read", async () => {
    renderWithQuery({ type: MsgTypeUrls.Delegate });

    await waitFor(() => {
      expect(screen.getByTestId("msg-form")).toHaveTextContent(MsgTypeUrls.Delegate);
    });
  });

  it("adds no message when ?type is absent", async () => {
    renderWithQuery({});

    await waitFor(() => {
      expect(screen.queryByTestId("msg-form")).not.toBeInTheDocument();
    });
  });

  it("ignores an unrecognised ?type instead of rendering a bogus form", async () => {
    renderWithQuery({ type: "/not.a.real.Msg" });

    await waitFor(() => {
      expect(screen.queryByTestId("msg-form")).not.toBeInTheDocument();
    });
  });
});
