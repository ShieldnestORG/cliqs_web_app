/**
 * Validator Unjail Test
 *
 * File: __tests__/lib/validator-unjail.test.ts
 *
 * Covers the pieces behind the "Unjail validator" action on the validator page:
 *   - buildUnjailMsg: the MsgUnjail the dashboard proposes (CLIQ) or signs (single wallet)
 *   - the consensus-address derivation the signing-info check depends on
 *   - getValidatorSigningInfo: the chain read that gates the button
 *   - getUnjailGate: the pure rule deciding hidden / disabled / enabled
 *
 * Trigger: 2026-10-08, the testnet validator Tokns.fi was jailed and could only be
 * unjailed through Developer Tools -> Import Transaction.
 *
 * Values marked "measured" were read from coreum-testnet-1 on 2026-10-08 (read-only
 * queries): the consensus pubkey of testcorevaloper14rm...cs0yk hashes to
 * testcorevalcons1866ulh...qwtf, and /cosmos/slashing/v1beta1/signing_infos/<that>
 * answered 200 where the address built from the operator bytes answered 404
 * "SigningInfo not found".
 *
 * Priority: P0
 */

// jest.setup.js stubs these cosmjs packages (no bech32, no wallets, no coins()). These tests need
// the real encoding and offline signing, so they opt out of the stubs.
jest.unmock("@cosmjs/encoding");
jest.unmock("@cosmjs/proto-signing");
jest.unmock("@cosmjs/amino");

import { aminoConverters, makeAppRegistry } from "@/lib/msg";
import { exportMsgToJson, gasOfTx, msgsFromJson } from "@/lib/txMsgHelpers";
import { formatJailedUntil, getUnjailGate } from "@/lib/validatorUnjail";
import {
  consensusPubkeyToAddress,
  getValidatorSigningInfo,
  parseValidator,
  validatorToConsensusAddress,
  ValidatorSigningInfo,
} from "@/lib/validatorHelpers";
import { buildUnjailMsg } from "@/lib/validatorTx";
import { MsgTypeUrls } from "@/types/txMsg";
import { DirectSecp256k1Wallet, EncodeObject } from "@cosmjs/proto-signing";
import { fromBase64 } from "@cosmjs/encoding";
import { AminoTypes, calculateFee, SigningStargateClient } from "@cosmjs/stargate";
import { PubKey } from "cosmjs-types/cosmos/crypto/ed25519/keys";
import { MsgUnjail } from "cosmjs-types/cosmos/slashing/v1beta1/tx";
import { Validator } from "cosmjs-types/cosmos/staking/v1beta1/staking";
import { randomBytes } from "crypto";

const VALOPER = "testcorevaloper14rmczf6t6qldyrqrv4jd0zzypkuymrhvxcs0yk"; // measured
const CONSENSUS_PUBKEY_B64 = "CXo9FPrHSQAn4RAhIRw04ry52nyOIBlvPiNH84qWasA="; // measured
const CONSENSUS_ADDRESS = "testcorevalcons1866ulh364ek4jds70f5ntw4hn58dq9xyx9qwtf"; // measured
const ED25519_URL = "/cosmos.crypto.ed25519.PubKey";

const ed25519Any = () => ({
  typeUrl: ED25519_URL,
  value: PubKey.encode(PubKey.fromPartial({ key: fromBase64(CONSENSUS_PUBKEY_B64) })).finish(),
});

const HOUR = 3_600_000;
const NOW = new Date("2026-10-08T18:00:00.000Z");

const signingInfo = (over: Partial<ValidatorSigningInfo> = {}): ValidatorSigningInfo => ({
  missedBlocksCounter: BigInt(0),
  jailedUntil: null,
  tombstoned: false,
  startHeight: BigInt(106766258),
  ...over,
});

describe("buildUnjailMsg: P0", () => {
  const build = () => buildUnjailMsg(VALOPER);

  it("returns a single MsgUnjail carrying the operator address as validatorAddr", () => {
    const msgs = build();
    expect(msgs).toEqual([
      { typeUrl: "/cosmos.slashing.v1beta1.MsgUnjail", value: { validatorAddr: VALOPER } },
    ]);
    expect(msgs[0].typeUrl).toBe(MsgTypeUrls.Unjail);
  });

  it("encodes through makeAppRegistry() and decodes back to the same address", () => {
    const [msg] = build();
    const registry = makeAppRegistry();
    const bytes = registry.encode(msg);
    const decoded = MsgUnjail.decode(bytes);
    expect(decoded.validatorAddr).toBe(VALOPER);
    const viaAny = registry.decode(registry.encodeAsAny(msg));
    expect((viaAny as MsgUnjail).validatorAddr).toBe(VALOPER);
  });

  it("converts to amino as cosmos-sdk/MsgUnjail with address = the valoper", () => {
    const aminoTypes = new AminoTypes(aminoConverters);
    expect(aminoTypes.toAmino(build()[0])).toEqual({
      type: "cosmos-sdk/MsgUnjail",
      value: { address: VALOPER },
    });
  });

  it("survives the JSON the CLIQ transaction is stored as (exportMsgToJson / msgsFromJson)", () => {
    const msgs = build();
    const stored = msgs.map(exportMsgToJson);
    expect(stored[0].value).toEqual({ validatorAddr: VALOPER });
    expect(msgsFromJson(stored)).toEqual(msgs);
  });
});

describe("Unjail gas: P0", () => {
  it("gasOfTx([Unjail]) is the 100,000 flat + 200,000 per-msg table value, above the 155,000 used on chain", () => {
    const gas = gasOfTx([MsgTypeUrls.Unjail]);
    expect(gas).toBe(300_000);
    expect(gas).toBeGreaterThanOrEqual(200_000);
    expect(gas).toBeGreaterThan(155_000); // gas used by tx 0A29BDE1...F1F on coreum-testnet-1
  });
});

describe("single-wallet path needs the app registry: P0", () => {
  // Measured: cosmjs defaultRegistryTypes does NOT contain MsgUnjail, so copying the
  // EditValidator connectWithSigner options verbatim would fail at signing time.
  const sign = async (options: Parameters<typeof SigningStargateClient.offline>[1]) => {
    const wallet = await DirectSecp256k1Wallet.fromKey(new Uint8Array(randomBytes(32)), "testcore");
    const [{ address }] = await wallet.getAccounts();
    const client = await SigningStargateClient.offline(wallet, options);
    const fee = calculateFee(gasOfTx([MsgTypeUrls.Unjail]), "0.0625utestcore");
    return client.sign(address, buildUnjailMsg(VALOPER) as EncodeObject[], fee, "", {
      accountNumber: 0,
      sequence: 0,
      chainId: "coreum-testnet-1",
    });
  };

  it("control: the default cosmjs registry cannot sign MsgUnjail", async () => {
    await expect(sign({})).rejects.toThrow(/Unregistered type url/);
  });

  it("signs offline once makeAppRegistry() is supplied", async () => {
    const txRaw = await sign({ registry: makeAppRegistry() });
    expect(txRaw.bodyBytes.length).toBeGreaterThan(0);
    expect(txRaw.signatures).toHaveLength(1);
  });
});

describe("consensusPubkeyToAddress: P0", () => {
  it("derives the valcons address from sha256 of the ed25519 key (measured on testnet)", () => {
    expect(consensusPubkeyToAddress(ed25519Any(), "testcore")).toBe(CONSENSUS_ADDRESS);
  });

  it("is NOT the address built from the operator bytes (that one answered 404 on chain)", () => {
    const fromOperatorBytes = validatorToConsensusAddress(VALOPER, "testcore");
    expect(fromOperatorBytes).not.toBe(CONSENSUS_ADDRESS);
    expect(consensusPubkeyToAddress(ed25519Any(), "testcore")).not.toBe(fromOperatorBytes);
  });

  it("uses the chain prefix (mainnet core -> corevalcons)", () => {
    expect(consensusPubkeyToAddress(ed25519Any(), "core")).toMatch(/^corevalcons1/);
  });

  it("returns undefined when the pubkey is missing or not ed25519", () => {
    expect(consensusPubkeyToAddress(undefined, "testcore")).toBeUndefined();
    expect(
      consensusPubkeyToAddress(
        { typeUrl: "/cosmos.crypto.secp256k1.PubKey", value: ed25519Any().value },
        "testcore",
      ),
    ).toBeUndefined();
  });

  it("parseValidator exposes the consensus address next to the jailed flag", () => {
    const validator = Validator.fromPartial({
      operatorAddress: VALOPER,
      jailed: true,
      consensusPubkey: ed25519Any(),
    });
    const info = parseValidator(validator, "testcore");
    expect(info.jailed).toBe(true);
    expect(info.consensusAddress).toBe(CONSENSUS_ADDRESS);
  });
});

describe("getValidatorSigningInfo: P0", () => {
  // jailed_until 2026-10-08T17:03:15.572528817Z is the measured value for Tokns.fi
  const abciResponse = {
    valSigningInfo: {
      address: CONSENSUS_ADDRESS,
      startHeight: BigInt(106766258),
      indexOffset: BigInt(2871),
      jailedUntil: { seconds: BigInt(1791478995), nanos: 572528817 },
      tombstoned: false,
      missedBlocksCounter: BigInt(0),
    },
  };
  const clientReturning = (response: unknown) =>
    ({ slashing: { signingInfo: jest.fn().mockResolvedValue(response) } }) as never;

  it("maps the chain's signing info and queries by consensus address", async () => {
    const client = clientReturning(abciResponse);
    const info = await getValidatorSigningInfo(client, CONSENSUS_ADDRESS);
    expect(info).toEqual({
      missedBlocksCounter: BigInt(0),
      jailedUntil: new Date("2026-10-08T17:03:15.572Z"),
      tombstoned: false,
      startHeight: BigInt(106766258),
    });
    expect(
      (client as never as { slashing: { signingInfo: jest.Mock } }).slashing.signingInfo,
    ).toHaveBeenCalledWith(CONSENSUS_ADDRESS);
  });

  it("reports tombstoned validators (double-sign sentinel jailed_until 9999-12-31)", async () => {
    const info = await getValidatorSigningInfo(
      clientReturning({
        valSigningInfo: {
          ...abciResponse.valSigningInfo,
          tombstoned: true,
          jailedUntil: { seconds: BigInt(253402300799), nanos: 0 },
        },
      }),
      CONSENSUS_ADDRESS,
    );
    expect(info?.tombstoned).toBe(true);
    expect(info?.jailedUntil?.toISOString()).toBe("9999-12-31T23:59:59.000Z");
  });

  it("treats a missing jailed_until as null", async () => {
    const info = await getValidatorSigningInfo(
      clientReturning({
        valSigningInfo: { ...abciResponse.valSigningInfo, jailedUntil: undefined },
      }),
      CONSENSUS_ADDRESS,
    );
    expect(info?.jailedUntil).toBeNull();
  });

  it("returns null (never throws) when the query fails or answers without signing info", async () => {
    const failing = {
      slashing: { signingInfo: jest.fn().mockRejectedValue(new Error("fetch failed")) },
    } as never;
    await expect(getValidatorSigningInfo(failing, CONSENSUS_ADDRESS)).resolves.toBeNull();
    await expect(
      getValidatorSigningInfo(clientReturning({ valSigningInfo: undefined }), CONSENSUS_ADDRESS),
    ).resolves.toBeNull();
  });

  // Measured on coreum-testnet-1 2026-10-08: 3 of 165 jailed validators (chainsaw, IPL2023,
  // sychonix; unbonded, never signed) answer exactly this. Cosmos SDK v0.53.8 (the version the
  // chain runs, node_info) x/slashing keeper/unjail.go: "A validator that is jailed but has no
  // ValidatorSigningInfo object ... was never bonded ... can unjail at any point", so the chain
  // applies no tombstone or jail-time check to it.
  it("treats a jailed validator with no signing record (never bonded) as unrestricted, not as unreadable", async () => {
    const notFound = {
      slashing: {
        signingInfo: jest
          .fn()
          .mockRejectedValue(
            new Error(
              "Query failed with (22): rpc error: code = NotFound desc = SigningInfo not found for validator testcorevalcons15e8ej4xltxnpjpeqv6k6c26hl9elje",
            ),
          ),
      },
    } as never;
    const info = await getValidatorSigningInfo(notFound, CONSENSUS_ADDRESS);
    expect(info).not.toBeNull();
    expect(info?.tombstoned).toBe(false);
    expect(info?.jailedUntil).toBeNull();
    expect(getUnjailGate({ jailed: true, signingInfo: info, now: NOW })).toEqual({
      status: "ready",
    });
  });
});

describe("getUnjailGate: P0", () => {
  it("is hidden when the validator is not jailed, whatever the signing info says", () => {
    expect(getUnjailGate({ jailed: false, signingInfo: null, now: NOW })).toEqual({
      status: "hidden",
    });
    expect(
      getUnjailGate({
        jailed: false,
        signingInfo: signingInfo({ tombstoned: true }),
        now: NOW,
      }),
    ).toEqual({ status: "hidden" });
  });

  it("is tombstoned (never unjailable) before any time check", () => {
    expect(
      getUnjailGate({ jailed: true, signingInfo: signingInfo({ tombstoned: true }), now: NOW }),
    ).toEqual({ status: "tombstoned" });
    // even with a jailed_until in the past
    expect(
      getUnjailGate({
        jailed: true,
        signingInfo: signingInfo({
          tombstoned: true,
          jailedUntil: new Date(NOW.getTime() - HOUR),
        }),
        now: NOW,
      }),
    ).toEqual({ status: "tombstoned" });
  });

  it("waits, with the time, while jailed_until is in the future", () => {
    const until = new Date(NOW.getTime() + 2 * HOUR);
    expect(
      getUnjailGate({ jailed: true, signingInfo: signingInfo({ jailedUntil: until }), now: NOW }),
    ).toEqual({ status: "waiting", until });
  });

  it("is ready once jailed_until has passed, is unset, or is the epoch", () => {
    for (const jailedUntil of [new Date(NOW.getTime() - HOUR), null, new Date(0)]) {
      expect(
        getUnjailGate({ jailed: true, signingInfo: signingInfo({ jailedUntil }), now: NOW }),
      ).toEqual({
        status: "ready",
      });
    }
  });

  it("is ready at the exact jailed_until instant (the chain rejects only while blockTime < jailed_until)", () => {
    expect(
      getUnjailGate({ jailed: true, signingInfo: signingInfo({ jailedUntil: NOW }), now: NOW }),
    ).toEqual({ status: "ready" });
  });

  it("is unverified when the signing info could not be read", () => {
    expect(getUnjailGate({ jailed: true, signingInfo: null, now: NOW })).toEqual({
      status: "unverified",
    });
  });
});

describe("formatJailedUntil: P1", () => {
  it("renders an unambiguous UTC timestamp", () => {
    expect(formatJailedUntil(new Date("2026-10-08T17:03:15.572Z"))).toBe("2026-10-08 17:03 UTC");
  });
});
