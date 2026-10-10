/**
 * Edit Validator Submit Test
 *
 * File: __tests__/components/validator-edit-submit.test.tsx
 *
 * The "Edit validator" dialog of the Manage section (ValidatorCommandsCard). The signing fence
 * cannot see this wiring (it hashes submitEdit itself, not the JSX that calls it), so this file
 * pins what the submit button does:
 *   - it is off until a field is switched on, and off while read-only (even with a field on)
 *   - direct mode: it signs one MsgEditValidator as the operator account, with the switched-on
 *     field set and every other field "[do-not-modify]"
 *   - CLIQ mode: it creates the same edit-validator CLIQ transaction for the CLIQ
 *   - all seven fields are wired to their own switch and input (a table: moniker, identity,
 *     website, securityContact, details, commissionRate, minSelfDelegation), in direct and in CLIQ
 *     mode: switch only that field on, type a distinct value, submit, and the message carries that
 *     value in that field and "[do-not-modify]" in every other description field (six
 *     single swaps of switch or input bindings survived the older single-field tests). The
 *     table also reads the screen: each switch shows its own field's state (only the clicked one
 *     on) and each text box shows its own field's value before and after typing (a switch `checked` or box `value` pointed at another field changed nothing in the message,
 *     so seven swaps of each survived the message-only table)
 *   - the Update button and Cancel are off while a submit is in flight (`isSubmitting`)
 *   - Cancel just closes the dialog and sends nothing
 *
 * Nothing here touches a chain: the signing client is a recording stub, and the CLIQ
 * transaction creator is mocked. The real message helpers run.
 *
 * Priority: P0
 */

// jest.setup.js stubs these cosmjs packages; the message helpers need the real encoding.
jest.unmock("@cosmjs/encoding");
jest.unmock("@cosmjs/proto-signing");
jest.unmock("@cosmjs/amino");

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ValidatorCommandsCard from "@/components/dataViews/ValidatorDashboard/ValidatorCommandsCard";
import { ValidatorInfo } from "@/lib/validatorHelpers";
import { createCliqTransaction } from "@/lib/validatorTx";
import { SigningStargateClient } from "@cosmjs/stargate";
import { MsgTypeUrls } from "@/types/txMsg";

const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk";
const OPERATOR_ACCOUNT = "testcore14rmczf6t6qldyrqrv4jd0zzypkuymrhvxjxlfl";
const CLIQ = "testcore1zc53xg3ml9hxe9n6q6tjkcs9t3mxqt9awgxsj0";
const DO_NOT_MODIFY = "[do-not-modify]";

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
      gasPrice: "0.0625utestcore",
      explorerLinks: { tx: "" },
    },
  }),
}));

const mockGetDirectSigner = jest.fn();
jest.mock("@/context/WalletContext", () => ({
  useWallet: () => ({
    walletInfo: { address: OPERATOR_ACCOUNT },
    getDirectSigner: mockGetDirectSigner,
  }),
}));

// Keep the real message helpers; replace only the part that writes to the database.
jest.mock("@/lib/validatorTx", () => ({
  ...jest.requireActual("@/lib/validatorTx"),
  createCliqTransaction: jest.fn(),
}));

// Five distinct, non-empty current values: a text box wired to another field's value would show
// the wrong text before anything is typed (the table below reads the box, not just the message).
const validator = {
  operatorAddress: VALOPER,
  delegatorAddress: OPERATOR_ACCOUNT,
  moniker: "Tokns.fi",
  identity: "0123456789ABCDEF",
  website: "https://old.tokns.fi",
  securityContact: "old-contact@tokns.fi",
  details: "Old validator details",
  commissionRate: "0.1",
  minSelfDelegation: "1",
} as ValidatorInfo;

type Props = Partial<React.ComponentProps<typeof ValidatorCommandsCard>>;
const renderCard = (props: Props = {}) =>
  render(<ValidatorCommandsCard validator={validator} {...props} />);

const openDialog = () => fireEvent.click(screen.getByRole("button", { name: "Edit validator" }));
const switchOn = (name: string) => fireEvent.click(screen.getByRole("switch", { name }));
const submit = () =>
  screen.getByRole("button", { name: /^(Update Validator|Create Transaction)$/ });

/** Stubs the signing client; returns the list of {address, messages} it was asked to sign. */
function stubSigningClient() {
  const sent: { address: string; messages: { typeUrl: string; value: unknown }[] }[] = [];
  jest.spyOn(SigningStargateClient, "connectWithSigner").mockResolvedValue({
    signAndBroadcast: async (address: string, messages: { typeUrl: string; value: unknown }[]) => {
      sent.push({ address, messages });
      return { code: 0, transactionHash: "TESTHASH", rawLog: "" };
    },
  } as unknown as SigningStargateClient);
  return sent;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDirectSigner.mockResolvedValue({});
  (createCliqTransaction as jest.Mock).mockResolvedValue({ success: true, txId: "5" });
});
afterEach(() => jest.restoreAllMocks());

describe("Edit validator submit button: P0", () => {
  it("is off until a field is switched on, then on", () => {
    renderCard();
    openDialog();

    expect(submit()).toBeDisabled();
    switchOn("Moniker (Name)");
    expect(submit()).toBeEnabled();
    switchOn("Moniker (Name)");
    expect(submit()).toBeDisabled();
  });

  it("is off while read-only, even with a field switched on, and sends nothing", async () => {
    const sent = stubSigningClient();
    renderCard({ readOnly: true });
    openDialog();
    switchOn("Moniker (Name)");

    expect(submit()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(submit());
    await Promise.resolve();
    expect(sent).toHaveLength(0);
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });

  it("in CLIQ mode it is off while read-only too, and creates nothing", async () => {
    renderCard({ readOnly: true, isCliqMode: true, cliqAddress: CLIQ });
    openDialog();
    switchOn("Website");

    expect(submit()).toBeDisabled();
    fireEvent.click(submit());
    await Promise.resolve();
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });

  it("Cancel closes the dialog and sends nothing", async () => {
    const sent = stubSigningClient();
    renderCard();
    openDialog();
    switchOn("Moniker (Name)");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByText("Edit Validator Details")).not.toBeInTheDocument(),
    );
    expect(sent).toHaveLength(0);
    expect(createCliqTransaction).not.toHaveBeenCalled();
  });
});

describe("Edit validator submit, direct signing: P0", () => {
  it("signs one MsgEditValidator as the operator account, changing only the switched-on field", async () => {
    const sent = stubSigningClient();
    renderCard();
    openDialog();
    switchOn("Moniker (Name)");
    fireEvent.change(screen.getByPlaceholderText("Enter validator name"), {
      target: { value: "Tokns Prime" },
    });

    fireEvent.click(submit());

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0].address).toBe(OPERATOR_ACCOUNT);
    expect(sent[0].messages).toEqual([
      {
        typeUrl: MsgTypeUrls.EditValidator,
        value: {
          validatorAddress: VALOPER,
          description: {
            moniker: "Tokns Prime",
            identity: DO_NOT_MODIFY,
            website: DO_NOT_MODIFY,
            securityContact: DO_NOT_MODIFY,
            details: DO_NOT_MODIFY,
          },
        },
      },
    ]);
  });
});

/**
 * The seven editable fields. `switchName` is the switch's label, `inputName` the text box's label
 * (they differ for Identity and Commission Rate), `initial` what the box shows when it opens (the
 * validator's own value for the five description fields; empty for the two numbers, which the
 * dialog clears), `typed` a value that differs from every `initial`, and `commissionRate` /
 * `minSelfDelegation` ride beside `description` in the message.
 */
const EDIT_FIELDS = [
  {
    key: "moniker",
    switchName: "Moniker (Name)",
    inputName: "Moniker (Name)",
    initial: validator.moniker,
    typed: "Tokns Prime",
  },
  {
    key: "identity",
    switchName: "Identity (Keybase)",
    inputName: "Identity",
    initial: validator.identity,
    typed: "A1B2C3D4E5F6A7B8",
  },
  {
    key: "website",
    switchName: "Website",
    inputName: "Website",
    initial: validator.website,
    typed: "https://tokns.fi",
  },
  {
    key: "securityContact",
    switchName: "Security Contact",
    inputName: "Security Contact",
    initial: validator.securityContact,
    typed: "security@tokns.fi",
  },
  {
    key: "details",
    switchName: "Details",
    inputName: "Details",
    initial: validator.details,
    typed: "Validator for the tests",
  },
  {
    key: "commissionRate",
    switchName: "Commission Rate",
    inputName: "Commission Rate (0.0 - 1.0)",
    initial: "",
    typed: "0.2",
  },
  {
    key: "minSelfDelegation",
    switchName: "Min Self Delegation",
    inputName: "Min Self Delegation",
    initial: "",
    typed: "5000000",
  },
] as const;

/** What MsgEditValidator must hold when ONLY `key` is switched on and `typed` was entered. */
function expectedEditValue(key: string, typed: string) {
  const description: Record<string, string> = {
    moniker: DO_NOT_MODIFY,
    identity: DO_NOT_MODIFY,
    website: DO_NOT_MODIFY,
    securityContact: DO_NOT_MODIFY,
    details: DO_NOT_MODIFY,
  };
  const value: Record<string, unknown> = { validatorAddress: VALOPER, description };
  if (key === "commissionRate") {
    value.commissionRate = "200000000000000000"; // 0.2 as an 18-decimal integer
  } else if (key === "minSelfDelegation") {
    value.minSelfDelegation = typed;
  } else {
    description[key] = typed;
  }
  return value;
}

/** Every switch shows its OWN field's state: `on` is the one field that is switched on, if any. */
const expectSwitches = (on?: string) => {
  for (const f of EDIT_FIELDS) {
    const box = screen.getByRole("switch", { name: f.switchName });
    if (f.key === on) expect(box).toBeChecked();
    else expect(box).not.toBeChecked();
  }
};

const fillOnly = (field: (typeof EDIT_FIELDS)[number]) => {
  openDialog();
  expectSwitches(); // all seven start off
  switchOn(field.switchName);
  expectSwitches(field.key); // only the clicked one shows on
  // only the one switch is on, so only its input is on the page
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  const input = screen.getByRole("textbox", { name: field.inputName });
  expect(input).toHaveValue(field.initial); // the box shows its own field's current value
  fireEvent.change(input, { target: { value: field.typed } });
  expect(input).toHaveValue(field.typed); // and then what was typed
  fireEvent.click(submit());
};

describe("Edit validator: each of the seven fields is wired to itself: P0", () => {
  it.each(EDIT_FIELDS)(
    "direct: switching on only $key sends $key and nothing else",
    async (field) => {
      const sent = stubSigningClient();
      renderCard();
      fillOnly(field);

      await waitFor(() => expect(sent).toHaveLength(1));
      expect(sent[0].address).toBe(OPERATOR_ACCOUNT);
      expect(sent[0].messages).toHaveLength(1);
      expect(sent[0].messages[0].typeUrl).toBe(MsgTypeUrls.EditValidator);
      expect(sent[0].messages[0].value).toStrictEqual(expectedEditValue(field.key, field.typed));
    },
  );

  it.each(EDIT_FIELDS)(
    "CLIQ: switching on only $key puts $key and nothing else in the CLIQ transaction",
    async (field) => {
      renderCard({ isCliqMode: true, cliqAddress: CLIQ });
      fillOnly(field);

      await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
      const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0].typeUrl).toBe(MsgTypeUrls.EditValidator);
      expect(call.messages[0].value).toStrictEqual(expectedEditValue(field.key, field.typed));
    },
  );
});

describe("Edit validator while the submit is in flight: P0", () => {
  it("Update and Cancel are off while the edit is being signed, and Update comes back after", async () => {
    let finishSigner!: (signer: unknown) => void;
    mockGetDirectSigner.mockReturnValue(
      new Promise((resolve) => {
        finishSigner = resolve;
      }),
    );
    renderCard();
    openDialog();
    switchOn("Moniker (Name)");

    fireEvent.click(submit());

    const busy = await screen.findByRole("button", { name: /Updating/ });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(mockGetDirectSigner).toHaveBeenCalledTimes(1);

    finishSigner(null); // no signer: the submit ends with an error toast, nothing was sent
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Update Validator" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});

describe("Edit validator submit, CLIQ mode: P0", () => {
  it("creates the edit-validator CLIQ transaction for the CLIQ", async () => {
    renderCard({ isCliqMode: true, cliqAddress: CLIQ });
    openDialog();
    switchOn("Website");
    fireEvent.change(screen.getByPlaceholderText("https://validator.com"), {
      target: { value: "https://tokns.fi" },
    });

    fireEvent.click(submit());

    await waitFor(() => expect(createCliqTransaction).toHaveBeenCalledTimes(1));
    const call = (createCliqTransaction as jest.Mock).mock.calls[0][0];
    expect(call.cliqAddress).toBe(CLIQ);
    expect(call.memo).toBe("Edit validator details");
    expect(call.messages).toHaveLength(1);
    expect(call.messages[0].typeUrl).toBe(MsgTypeUrls.EditValidator);
    expect(call.messages[0].value.validatorAddress).toBe(VALOPER);
    expect(call.messages[0].value.description).toEqual({
      moniker: DO_NOT_MODIFY,
      identity: DO_NOT_MODIFY,
      website: "https://tokns.fi",
      securityContact: DO_NOT_MODIFY,
      details: DO_NOT_MODIFY,
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/tx/${CLIQ}/transaction/5`));
  });
});
