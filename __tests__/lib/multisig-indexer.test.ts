jest.mock("@cosmjs/crypto", () => ({
  sha256: jest.fn().mockReturnValue(new Uint8Array([9, 9, 9])),
}));

jest.mock("@cosmjs/encoding", () => ({
  fromBase64: jest.fn().mockImplementation((value: string) => new Uint8Array([value.length])),
  fromBech32: jest.fn().mockReturnValue({ prefix: "cosmos", data: new Uint8Array([1, 2, 3]) }),
  toHex: jest.fn().mockImplementation((value: Uint8Array) =>
    Array.from(value)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(""),
  ),
}));

jest.mock("@cosmjs/amino", () => ({
  createMultisigThresholdPubkey: jest.fn().mockImplementation((pubkeys, threshold) => ({
    type: "tendermint/PubKeyMultisigThreshold",
    value: { threshold: String(threshold), pubkeys },
  })),
  isMultisigThresholdPubkey: jest
    .fn()
    .mockImplementation(
      (value) =>
        Boolean(
          value &&
            typeof value === "object" &&
            value.type === "tendermint/PubKeyMultisigThreshold" &&
            value.value,
        ),
    ),
  isSecp256k1Pubkey: jest
    .fn()
    .mockImplementation((value) => value?.type === "tendermint/PubKeySecp256k1"),
  pubkeyToAddress: jest
    .fn()
    .mockImplementation(
      (pubkey, prefix) => `${prefix}1${String(pubkey.value).slice(0, 6).toLowerCase()}`,
    ),
}));

import { buildMultisigIndexerImportPayload, getPubkeyFingerprint } from "@/lib/multisigIndexer";

describe("multisigIndexer", () => {
  it("builds an import payload with member addresses and pubkey fingerprints", () => {
    const memberPubkeys = ["memberPubkeyOneBase64", "memberPubkeyTwoBase64"];
    const multisigAddress = "cosmos1multisig";
    const multisigPubkey = {
      type: "tendermint/PubKeyMultisigThreshold",
      value: {
        threshold: "2",
        pubkeys: memberPubkeys.map((value) => ({
          type: "tendermint/PubKeySecp256k1",
          value,
        })),
      },
    };

    const payload = buildMultisigIndexerImportPayload({
      chainId: "cosmoshub-4",
      address: multisigAddress,
      creator: "cosmos1creator",
      pubkeyJSON: JSON.stringify(multisigPubkey),
      name: "Treasury",
      description: "Team treasury",
    });

    expect(payload.chainId).toBe("cosmoshub-4");
    expect(payload.multisigAddress).toBe(multisigAddress);
    expect(payload.threshold).toBe(2);
    expect(payload.members).toHaveLength(2);
    expect(payload.members[0]).toMatchObject({
      address: "cosmos1member",
      pubkey: memberPubkeys[0],
      pubkeyFingerprint: "sha256:090909",
      weight: 1,
      position: 0,
    });
    expect(payload.label).toBe("Treasury");
    expect(payload.description).toBe("Team treasury");
    expect(payload.source).toBe("app_import");
  });

  it("fingerprints pubkeys with a sha256 prefix", () => {
    expect(getPubkeyFingerprint("memberPubkeyOneBase64")).toBe("sha256:090909");
  });
});
