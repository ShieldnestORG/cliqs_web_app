// jest.setup.js replaces @cosmjs/encoding with a partial mock that has no utf8
// helpers; this suite needs the real ones.
jest.mock("@cosmjs/encoding", () => jest.requireActual("@cosmjs/encoding"));

import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";
import { toUtf8 } from "@cosmjs/encoding";
import { MsgCodecs, MsgTypeUrls } from "@/types/txMsg";
import {
  matchesConfirmTail,
  needsTypedConfirmation,
  summariseAuthzGrant,
  summariseWasmMsg,
} from "./intentSummary";
import { isExternalArrival } from "./DevToolsArrivalGate";

const buildGrant = (msgType: string) =>
  MsgGrant.fromPartial({
    granter: "core1granterxxxxxxxxxxxxxxxxxxxxxxxxxaaaaaa",
    grantee: "core1granteexxxxxxxxxxxxxxxxxxxxxxxxxzz9k7q",
    grant: {
      authorization: {
        typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
        value: GenericAuthorization.encode(
          GenericAuthorization.fromPartial({ msg: msgType }),
        ).finish(),
      },
      expiration: Timestamp.fromPartial({
        seconds: BigInt(Math.floor(new Date("2028-01-01T00:00:00Z").getTime() / 1000)),
        nanos: 0,
      }),
    },
  });

describe("authz grant summary", () => {
  it("reads the granted power out of the encoded authorization", () => {
    const summary = summariseAuthzGrant(buildGrant("/cosmos.bank.v1beta1.MsgSend"));
    expect(summary.sentence).toContain("core1granteexxxxxxxxxxxxxxxxxxxxxxxxxzz9k7q");
    expect(summary.sentence).toContain("send your tokens to any address, in any amount");
    expect(summary.sentence).toContain("until 2028-01-01");
    expect(summary.consequences.join(" ")).toContain("no spending limit");
    expect(summary.confirmTarget).toBe("core1granteexxxxxxxxxxxxxxxxxxxxxxxxxzz9k7q");
    expect(summary.facts).toEqual(
      expect.arrayContaining([
        { label: "Permission granted", value: "/cosmos.bank.v1beta1.MsgSend" },
        { label: "Expires", value: "2028-01-01" },
      ]),
    );
  });

  it("names an unknown permission verbatim instead of inventing one", () => {
    const summary = summariseAuthzGrant(buildGrant("/some.custom.v1.MsgWhatever"));
    expect(summary.sentence).toContain(
      'send "/some.custom.v1.MsgWhatever" transactions in your name',
    );
  });
});

describe("wasm message summaries", () => {
  it("summarises MsgUpdateAdmin from the message that will be signed", () => {
    const msg = {
      typeUrl: MsgTypeUrls.UpdateAdmin,
      value: MsgCodecs[MsgTypeUrls.UpdateAdmin].fromPartial({
        sender: "core1senderxxxxxxxxxxxxxxxxxxxxxxxxxxx4uc9p",
        contract: "core1contractxxxxxxxxxxxxxxxxxxxxxxxxxjj3m2",
        newAdmin: "core1newadminxxxxxxxxxxxxxxxxxxxxxxxxxab12cd",
      }),
    };
    const summary = summariseWasmMsg(MsgTypeUrls.UpdateAdmin, msg);
    expect(summary?.sentence).toBe(
      "You are making core1newadminxxxxxxxxxxxxxxxxxxxxxxxxxab12cd the admin of contract core1contractxxxxxxxxxxxxxxxxxxxxxxxxxjj3m2.",
    );
    expect(summary?.confirmTarget).toBe("core1newadminxxxxxxxxxxxxxxxxxxxxxxxxxab12cd");
  });

  it("summarises MsgMigrateContract including the decoded migrate message", () => {
    const msg = {
      typeUrl: MsgTypeUrls.MigrateContract,
      value: MsgCodecs[MsgTypeUrls.MigrateContract].fromPartial({
        sender: "core1senderxxxxxxxxxxxxxxxxxxxxxxxxxxx4uc9p",
        contract: "core1contractxxxxxxxxxxxxxxxxxxxxxxxxxjj3m2",
        codeId: 77n,
        msg: toUtf8(JSON.stringify({ migrate: {} })),
      }),
    };
    const summary = summariseWasmMsg(MsgTypeUrls.MigrateContract, msg);
    expect(summary?.sentence).toContain("code ID 77");
    expect(summary?.facts).toEqual(
      expect.arrayContaining([
        { label: "Migrate message sent to the contract", value: '{"migrate":{}}' },
      ]),
    );
    expect(summary?.confirmTarget).toBe("core1contractxxxxxxxxxxxxxxxxxxxxxxxxxjj3m2");
  });

  it("refuses to summarise a message whose typeUrl does not match", () => {
    expect(
      summariseWasmMsg(MsgTypeUrls.UpdateAdmin, {
        typeUrl: MsgTypeUrls.MigrateContract,
        value: {},
      }),
    ).toBeNull();
  });

  it("only demands typed confirmation for the irreversible message types", () => {
    expect(needsTypedConfirmation(MsgTypeUrls.UpdateAdmin)).toBe(true);
    expect(needsTypedConfirmation(MsgTypeUrls.MigrateContract)).toBe(true);
    expect(needsTypedConfirmation(MsgTypeUrls.ExecuteContract)).toBe(false);
  });
});

describe("typed confirmation matching", () => {
  it("accepts the last six characters, case-insensitively, and rejects anything else", () => {
    expect(matchesConfirmTail("ab12cd", "core1newadminxxxxxxxxxxxxxxxxxxxxxxxxxab12cd")).toBe(true);
    expect(matchesConfirmTail(" AB12CD ", "core1newadminxxxxxxxxxxxxxxxxxxxxxxxxxab12cd")).toBe(
      true,
    );
    expect(matchesConfirmTail("ab12c", "core1newadminxxxxxxxxxxxxxxxxxxxxxxxxxab12cd")).toBe(false);
    expect(matchesConfirmTail("", "")).toBe(false);
  });
});

describe("external arrival detection", () => {
  const setReferrer = (value: string) => {
    Object.defineProperty(document, "referrer", { value, configurable: true });
  };

  const stubNavigation = (entry: { type: string; name: string } | null) => {
    Object.defineProperty(performance, "getEntriesByType", {
      value: () => (entry ? [entry] : []),
      configurable: true,
    });
  };

  it("treats a client-side move inside the app as internal", () => {
    stubNavigation({ type: "navigate", name: "http://localhost/coreum/dashboard" });
    setReferrer("");
    expect(isExternalArrival()).toBe(false);
  });

  it("treats a reload of this page as internal", () => {
    stubNavigation({ type: "reload", name: "http://localhost/" });
    setReferrer("");
    expect(isExternalArrival()).toBe(false);
  });

  it("treats a same-origin link straight onto this page as internal", () => {
    stubNavigation({ type: "navigate", name: "http://localhost/" });
    setReferrer("http://localhost/coreum/dashboard");
    expect(isExternalArrival()).toBe(false);
  });

  it("treats an off-origin link straight onto this page as external", () => {
    stubNavigation({ type: "navigate", name: "http://localhost/" });
    setReferrer("https://evil.example/phish");
    expect(isExternalArrival()).toBe(true);
  });

  it("treats a stripped referrer straight onto this page as external", () => {
    stubNavigation({ type: "navigate", name: "http://localhost/" });
    setReferrer("");
    expect(isExternalArrival()).toBe(true);
  });
});
