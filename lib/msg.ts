import { txCosmJsTypes } from "@/types/cosmjs-types";
import { Registry, GeneratedType } from "@cosmjs/proto-signing";
import { createWasmAminoConverters, wasmTypes } from "@cosmjs/cosmwasm-stargate";
import { AminoConverters, createDefaultAminoConverters, defaultRegistryTypes } from "@cosmjs/stargate";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { SendAuthorization } from "cosmjs-types/cosmos/bank/v1beta1/authz";
import { MsgExec, MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import {
  MsgSetWithdrawAddress,
  MsgWithdrawDelegatorReward,
} from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgUnjail } from "cosmjs-types/cosmos/slashing/v1beta1/tx";
import { MsgDelegate, MsgUndelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { Timestamp } from "cosmjs-types/google/protobuf/timestamp";
import { BinaryReader, BinaryWriter } from "cosmjs-types/binary";

interface InnerMsgCodec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encode: (msg: any) => { finish(): Uint8Array };
  decode: (bytes: Uint8Array) => unknown;
  aminoType: string;
  toAmino: (val: unknown) => Record<string, unknown>;
  fromAmino: (val: Record<string, unknown>) => unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coin = (c: any) => ({ denom: c.denom, amount: c.amount });

/**
 * Format a proto Timestamp to RFC3339 matching Go's time.RFC3339Nano.
 * Go omits sub-second digits when nanoseconds are zero ("2028-01-01T00:00:00Z"),
 * while JS toISOString() always emits ".000Z". A mismatch causes amino
 * signature verification to fail on-chain.
 */
function timestampToRfc3339(seconds: bigint | number, nanos: number): string {
  const date = new Date(Number(seconds) * 1000);
  if (nanos > 0) {
    const nanoStr = nanos.toString().padStart(9, "0").replace(/0+$/, "");
    return date.toISOString().replace(/\.\d{3}Z$/, `.${nanoStr}Z`);
  }
  return date.toISOString().replace(/\.000Z$/, "Z");
}

/**
 * Minimal protobuf codec for /coreum.asset.nft.v1.MsgBurn.
 * Fields: sender (1), class_id (2), id (3) — all strings.
 * No cosmjs-types package exists for Coreum-specific modules, so we
 * hand-roll encode/decode following the same BinaryWriter/BinaryReader
 * pattern that cosmjs-types uses internally.
 */
interface CoreumMsgBurnFields {
  sender: string;
  classId: string;
  id: string;
}

const CoreumMsgBurn = {
  encode(message: CoreumMsgBurnFields, writer?: BinaryWriter) {
    const w = writer ?? BinaryWriter.create();
    if (message.sender !== "") w.uint32(10).string(message.sender);
    if (message.classId !== "") w.uint32(18).string(message.classId);
    if (message.id !== "") w.uint32(26).string(message.id);
    return w;
  },
  decode(input: Uint8Array): CoreumMsgBurnFields {
    const reader = new BinaryReader(input);
    const end = input.length;
    const message: CoreumMsgBurnFields = { sender: "", classId: "", id: "" };
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.sender = reader.string();
          break;
        case 2:
          message.classId = reader.string();
          break;
        case 3:
          message.id = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  fromPartial(obj: Partial<CoreumMsgBurnFields>): CoreumMsgBurnFields {
    return { sender: obj.sender ?? "", classId: obj.classId ?? "", id: obj.id ?? "" };
  },
};

const EXEC_INNER_CODECS: Record<string, InnerMsgCodec> = {
  "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress": {
    encode: MsgSetWithdrawAddress.encode,
    decode: MsgSetWithdrawAddress.decode,
    aminoType: "cosmos-sdk/MsgModifyWithdrawAddress",
    toAmino: (v) => {
      const m = v as MsgSetWithdrawAddress;
      return { delegator_address: m.delegatorAddress, withdraw_address: m.withdrawAddress };
    },
    fromAmino: (v) =>
      MsgSetWithdrawAddress.fromPartial({
        delegatorAddress: v.delegator_address as string,
        withdrawAddress: v.withdraw_address as string,
      }),
  },
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": {
    encode: MsgWithdrawDelegatorReward.encode,
    decode: MsgWithdrawDelegatorReward.decode,
    aminoType: "cosmos-sdk/MsgWithdrawDelegationReward",
    toAmino: (v) => {
      const m = v as MsgWithdrawDelegatorReward;
      return { delegator_address: m.delegatorAddress, validator_address: m.validatorAddress };
    },
    fromAmino: (v) =>
      MsgWithdrawDelegatorReward.fromPartial({
        delegatorAddress: v.delegator_address as string,
        validatorAddress: v.validator_address as string,
      }),
  },
  "/cosmos.staking.v1beta1.MsgDelegate": {
    encode: MsgDelegate.encode,
    decode: MsgDelegate.decode,
    aminoType: "cosmos-sdk/MsgDelegate",
    toAmino: (v) => {
      const m = v as ReturnType<typeof MsgDelegate.fromPartial>;
      return {
        delegator_address: m.delegatorAddress,
        validator_address: m.validatorAddress,
        amount: m.amount ? coin(m.amount) : undefined,
      };
    },
    fromAmino: (v) =>
      MsgDelegate.fromPartial({
        delegatorAddress: v.delegator_address as string,
        validatorAddress: v.validator_address as string,
        amount: v.amount as { denom: string; amount: string },
      }),
  },
  "/cosmos.staking.v1beta1.MsgUndelegate": {
    encode: MsgUndelegate.encode,
    decode: MsgUndelegate.decode,
    aminoType: "cosmos-sdk/MsgUndelegate",
    toAmino: (v) => {
      const m = v as ReturnType<typeof MsgUndelegate.fromPartial>;
      return {
        delegator_address: m.delegatorAddress,
        validator_address: m.validatorAddress,
        amount: m.amount ? coin(m.amount) : undefined,
      };
    },
    fromAmino: (v) =>
      MsgUndelegate.fromPartial({
        delegatorAddress: v.delegator_address as string,
        validatorAddress: v.validator_address as string,
        amount: v.amount as { denom: string; amount: string },
      }),
  },
  "/cosmos.slashing.v1beta1.MsgUnjail": {
    encode: MsgUnjail.encode,
    decode: MsgUnjail.decode,
    aminoType: "cosmos-sdk/MsgUnjail",
    toAmino: (v) => {
      const m = v as MsgUnjail;
      return { address: m.validatorAddr };
    },
    fromAmino: (v) =>
      MsgUnjail.fromPartial({
        validatorAddr:
          (typeof v.address === "string"
            ? v.address
            : typeof v.validator_addr === "string"
              ? v.validator_addr
              : v.validatorAddr) as string,
      }),
  },
  "/cosmos.bank.v1beta1.MsgSend": {
    encode: MsgSend.encode,
    decode: MsgSend.decode,
    aminoType: "cosmos-sdk/MsgSend",
    toAmino: (v) => {
      const m = v as ReturnType<typeof MsgSend.fromPartial>;
      return {
        from_address: m.fromAddress,
        to_address: m.toAddress,
        amount: (m.amount ?? []).map(coin),
      };
    },
    fromAmino: (v) =>
      MsgSend.fromPartial({
        fromAddress: v.from_address as string,
        toAddress: v.to_address as string,
        amount: v.amount as { denom: string; amount: string }[],
      }),
  },
  "/coreum.asset.nft.v1.MsgBurn": {
    encode: CoreumMsgBurn.encode,
    decode: (bytes: Uint8Array) => CoreumMsgBurn.decode(bytes),
    aminoType: "coreum/asset/nft/MsgBurn",
    toAmino: (v) => {
      const m = v as CoreumMsgBurnFields;
      return { sender: m.sender, class_id: m.classId, id: m.id };
    },
    fromAmino: (v) =>
      CoreumMsgBurn.fromPartial({
        sender: v.sender as string,
        classId: v.class_id as string,
        id: v.id as string,
      }),
  },
};

export { EXEC_INNER_CODECS };

const aminoTypeToTypeUrl = new Map(
  Object.entries(EXEC_INNER_CODECS).map(([typeUrl, c]) => [c.aminoType, typeUrl]),
);

function makeAuthzAminoConverters(): AminoConverters {
  return {
    "/cosmos.authz.v1beta1.MsgExec": {
      aminoType: "cosmos-sdk/MsgExec",
      toAmino: ({ grantee, msgs }: MsgExec) => ({
        grantee,
        msgs: msgs.map((msg) => {
          const codec = EXEC_INNER_CODECS[msg.typeUrl];
          if (!codec) throw new Error(`No amino codec for inner MsgExec message: ${msg.typeUrl}`);
          const decoded = codec.decode(msg.value);
          return { type: codec.aminoType, value: codec.toAmino(decoded) };
        }),
      }),
      fromAmino: ({
        grantee,
        msgs,
      }: {
        grantee: string;
        msgs: { type: string; value: Record<string, unknown> }[];
      }): MsgExec =>
        MsgExec.fromPartial({
          grantee,
          msgs: msgs.map((aminoMsg) => {
            const typeUrl = aminoTypeToTypeUrl.get(aminoMsg.type);
            if (!typeUrl) throw new Error(`No proto codec for amino type: ${aminoMsg.type}`);
            const codec = EXEC_INNER_CODECS[typeUrl];
            const proto = codec.fromAmino(aminoMsg.value);
            return { typeUrl, value: codec.encode(proto).finish() };
          }),
        }),
    },
    "/cosmos.authz.v1beta1.MsgGrant": {
      aminoType: "cosmos-sdk/MsgGrant",
      toAmino: ({ granter, grantee, grant }: MsgGrant) => {
        const authorization = grant?.authorization;
        if (!authorization) throw new Error("Missing authorization in MsgGrant");

        let aminoAuth: { type: string; value: Record<string, unknown> };
        switch (authorization.typeUrl) {
          case "/cosmos.authz.v1beta1.GenericAuthorization": {
            const decoded = GenericAuthorization.decode(authorization.value);
            aminoAuth = { type: "cosmos-sdk/GenericAuthorization", value: { msg: decoded.msg } };
            break;
          }
          case "/cosmos.bank.v1beta1.SendAuthorization": {
            const decoded = SendAuthorization.decode(authorization.value);
            aminoAuth = {
              type: "cosmos-sdk/SendAuthorization",
              value: {
                spend_limit: decoded.spendLimit.map((c) => ({ denom: c.denom, amount: c.amount })),
                allow_list: decoded.allowList,
              },
            };
            break;
          }
          default:
            throw new Error(
              `Unsupported authorization type for amino signing: ${authorization.typeUrl}`,
            );
        }

        let expiration: string | undefined;
        if (grant?.expiration) {
          expiration = timestampToRfc3339(grant.expiration.seconds, grant.expiration.nanos);
        }

        return {
          granter,
          grantee,
          grant: { authorization: aminoAuth, expiration: expiration ?? "" },
        };
      },
      fromAmino: ({
        granter,
        grantee,
        grant,
      }: {
        granter: string;
        grantee: string;
        grant: {
          authorization: { type: string; value: Record<string, unknown> };
          expiration?: string;
        };
      }): MsgGrant => {
        let protoAuth: { typeUrl: string; value: Uint8Array };
        switch (grant.authorization.type) {
          case "cosmos-sdk/GenericAuthorization":
            protoAuth = {
              typeUrl: "/cosmos.authz.v1beta1.GenericAuthorization",
              value: GenericAuthorization.encode(
                GenericAuthorization.fromPartial({ msg: grant.authorization.value.msg as string }),
              ).finish(),
            };
            break;
          case "cosmos-sdk/SendAuthorization":
            protoAuth = {
              typeUrl: "/cosmos.bank.v1beta1.SendAuthorization",
              value: SendAuthorization.encode(
                SendAuthorization.fromPartial({
                  spendLimit: grant.authorization.value.spend_limit as {
                    denom: string;
                    amount: string;
                  }[],
                  allowList: (grant.authorization.value.allow_list as string[]) ?? [],
                }),
              ).finish(),
            };
            break;
          default:
            throw new Error(`Unsupported amino authorization type: ${grant.authorization.type}`);
        }

        let protoExpiration: Timestamp | undefined;
        if (grant.expiration) {
          const ms = new Date(grant.expiration).getTime();
          protoExpiration = Timestamp.fromPartial({
            seconds: BigInt(Math.floor(ms / 1000)),
            nanos: (ms % 1000) * 1_000_000,
          });
        }

        return MsgGrant.fromPartial({
          granter,
          grantee,
          grant: { authorization: protoAuth, expiration: protoExpiration },
        });
      },
    },
    "/cosmos.authz.v1beta1.MsgRevoke": {
      aminoType: "cosmos-sdk/MsgRevoke",
      toAmino: ({ granter, grantee, msgTypeUrl }: MsgRevoke) => ({
        granter,
        grantee,
        msg_type_url: msgTypeUrl,
      }),
      fromAmino: ({
        granter,
        grantee,
        msg_type_url,
      }: {
        granter: string;
        grantee: string;
        msg_type_url: string;
      }): MsgRevoke => MsgRevoke.fromPartial({ granter, grantee, msgTypeUrl: msg_type_url }),
    },
  };
}

function makeExtraAminoConverters(): AminoConverters {
  return {
    "/cosmos.slashing.v1beta1.MsgUnjail": {
      aminoType: "cosmos-sdk/MsgUnjail",
      toAmino: ({ validatorAddr }: MsgUnjail) => ({
        address: validatorAddr,
      }),
      fromAmino: ({ address, validator_addr, validatorAddr }: Record<string, unknown>) =>
        MsgUnjail.fromPartial({
          validatorAddr: (address ?? validator_addr ?? validatorAddr) as string,
        }),
    },
  };
}

export const aminoConverters = {
  ...createDefaultAminoConverters(),
  ...createWasmAminoConverters(),
  ...makeAuthzAminoConverters(),
  ...makeExtraAminoConverters(),
};

export const makeAppRegistry = () => {
  const registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  registry.register(MsgUnjail.typeUrl, MsgUnjail as GeneratedType);
  return registry;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const msgRegistry: Record<string, any> = {};

const codecs = txCosmJsTypes
  .filter(
    (type) =>
      typeof type === "object" &&
      "typeUrl" in type &&
      "encode" in type &&
      "decode" in type &&
      "fromJSON" in type &&
      "toJSON" in type &&
      "fromPartial" in type,
  )
  .filter((type) => Object.keys(aminoConverters).includes(type.typeUrl));

for (const codec of codecs) {
  const splitTypeUrl = codec.typeUrl.split(".");
  const name = splitTypeUrl[splitTypeUrl.length - 1];
  const category = splitTypeUrl[0] === "/cosmos" ? splitTypeUrl[1] : splitTypeUrl[0].slice(1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emptyMsg = (codec as any).fromPartial({});

  msgRegistry[codec.typeUrl] = {
    typeUrl: codec.typeUrl,
    category,
    name,
    fields: Object.keys(emptyMsg),
    emptyMsg,
    codec,
  };
}

export const getMsgRegistry = () => msgRegistry;
