import { MsgTypeUrl, MsgTypeUrls } from "@/types/txMsg";
import { fromUtf8 } from "@cosmjs/encoding";
import { EncodeObject } from "@cosmjs/proto-signing";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { MsgGrant } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { MsgMigrateContract, MsgUpdateAdmin } from "cosmjs-types/cosmwasm/wasm/v1/tx";

export interface IntentFact {
  readonly label: string;
  readonly value: string;
}

export interface IntentSummary {
  readonly title: string;
  /** One sentence a non-expert can read: what signing this actually authorises. */
  readonly sentence: string;
  readonly consequences: readonly string[];
  /** Values read back out of the message that will be signed, never re-typed by hand. */
  readonly facts: readonly IntentFact[];
  /** The value whose last characters the user has to re-type to continue. */
  readonly confirmTarget: string;
  readonly confirmTargetLabel: string;
}

export const CONFIRM_TAIL_LENGTH = 6;

export const confirmTail = (value: string) => value.slice(-CONFIRM_TAIL_LENGTH);

export const matchesConfirmTail = (typed: string, target: string) =>
  target.length > 0 && typed.trim().toLowerCase() === confirmTail(target).toLowerCase();

const GENERIC_AUTHORIZATION_TYPE_URL = "/cosmos.authz.v1beta1.GenericAuthorization";

// Plain-language reading of each permission the Authz grant form can hand out. The
// grant is always a GenericAuthorization, which carries no amount limit, so the
// wording must not imply one.
const AUTHZ_POWERS: Readonly<Record<string, string>> = {
  "/cosmos.bank.v1beta1.MsgSend": "send your tokens to any address, in any amount",
  "/cosmos.staking.v1beta1.MsgDelegate": "stake (delegate) your tokens to any validator",
  "/cosmos.staking.v1beta1.MsgUndelegate": "unstake (undelegate) your staked tokens",
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": "claim your staking rewards",
  "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress":
    "change the address your staking rewards are paid to",
  "/cosmos.authz.v1beta1.MsgExec": "use other permissions that were granted to your account",
  "/coreum.asset.nft.v1.MsgBurn": "permanently destroy (burn) your NFTs",
};

const describeAuthzPower = (msgTypeUrl: string) =>
  AUTHZ_POWERS[msgTypeUrl] ?? `send "${msgTypeUrl}" transactions in your name`;

const formatExpiryDate = (seconds?: bigint) => {
  if (seconds === undefined) return null;
  const asDate = new Date(Number(seconds) * 1000);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString().slice(0, 10);
};

export const summariseAuthzGrant = (msg: MsgGrant): IntentSummary => {
  const authorization = msg.grant?.authorization;
  const grantedMsgType =
    authorization?.typeUrl === GENERIC_AUTHORIZATION_TYPE_URL && authorization.value?.length
      ? GenericAuthorization.decode(authorization.value).msg
      : (authorization?.typeUrl ?? "");
  const expiryDate = formatExpiryDate(msg.grant?.expiration?.seconds);
  const power = describeAuthzPower(grantedMsgType);

  const consequences = [
    expiryDate
      ? `They will not be asked again. The permission works until ${expiryDate}, or until you revoke it from the Revoke tab.`
      : "They will not be asked again. The permission works until you revoke it from the Revoke tab.",
    "Revoking is a separate transaction. Until you send it, the permission stays live.",
  ];

  if (grantedMsgType === "/cosmos.bank.v1beta1.MsgSend") {
    consequences.push(
      "This permission has no spending limit: it covers everything in your account, now and anything that arrives later.",
    );
  }
  if (grantedMsgType === "/cosmos.distribution.v1beta1.MsgSetWithdrawAddress") {
    consequences.push(
      "They could point all of your future staking rewards at an address they control.",
    );
  }
  if (grantedMsgType === "/cosmos.authz.v1beta1.MsgExec") {
    consequences.push(
      "This is a permission to use permissions. It can reach anything your account has already been granted.",
    );
  }

  return {
    title: "You are giving another account power over your funds",
    sentence: `You are giving ${msg.grantee} permission to ${power} using your own account, ${
      expiryDate ? `until ${expiryDate}` : "with no expiry date"
    }.`,
    consequences,
    facts: [
      { label: "Your account (granter)", value: msg.granter },
      { label: "Gets the permission (grantee)", value: msg.grantee },
      { label: "Permission granted", value: grantedMsgType || "(unreadable)" },
      { label: "Expires", value: expiryDate ?? "never" },
    ],
    confirmTarget: msg.grantee,
    confirmTargetLabel: "the address you are granting to",
  };
};

const summariseUpdateAdmin = (value: MsgUpdateAdmin): IntentSummary | null => {
  if (!value?.contract || !value?.newAdmin) return null;

  return {
    title: "You are handing over control of a contract",
    sentence: `You are making ${value.newAdmin} the admin of contract ${value.contract}.`,
    consequences: [
      "The admin of a contract can replace that contract's code whenever it likes, which can change how it handles money.",
      `If ${value.sender || "your account"} is the current admin, it stops being the admin the moment this succeeds.`,
      "Only the new admin can hand control back. You cannot undo this from this page.",
    ],
    facts: [
      { label: "Contract", value: value.contract },
      { label: "New admin", value: value.newAdmin },
      { label: "Sent by", value: value.sender || "(unset)" },
    ],
    confirmTarget: value.newAdmin,
    confirmTargetLabel: "the new admin address",
  };
};

const decodeMigrateMsg = (bytes?: Uint8Array) => {
  if (!bytes || bytes.length === 0) return "{}";
  try {
    return fromUtf8(bytes);
  } catch {
    return "(not readable text)";
  }
};

const summariseMigrateContract = (value: MsgMigrateContract): IntentSummary | null => {
  if (!value?.contract || value?.codeId === undefined) return null;

  return {
    title: "You are replacing the code of a live contract",
    sentence: `You are replacing the code that runs contract ${value.contract} with code ID ${value.codeId.toString()}.`,
    consequences: [
      "Everybody who uses that contract is affected the moment this succeeds, including anyone whose funds it holds.",
      "The old code is not kept in place. Going back needs another migration to the old code ID, and only the admin can do it.",
      "If the new code is not what you think it is, it can take whatever the contract controls.",
    ],
    facts: [
      { label: "Contract", value: value.contract },
      { label: "New code ID", value: value.codeId.toString() },
      { label: "Migrate message sent to the contract", value: decodeMigrateMsg(value.msg) },
      { label: "Sent by", value: value.sender || "(unset)" },
    ],
    confirmTarget: value.contract,
    confirmTargetLabel: "the contract address being replaced",
  };
};

/** Message types on this page that cannot be undone and so need a typed confirmation. */
export const IRREVERSIBLE_MSG_TYPES: readonly MsgTypeUrl[] = [
  MsgTypeUrls.UpdateAdmin,
  MsgTypeUrls.MigrateContract,
];

export const needsTypedConfirmation = (msgType: MsgTypeUrl) =>
  IRREVERSIBLE_MSG_TYPES.includes(msgType);

/**
 * Builds the summary from the message object that is about to be signed, so the
 * wording cannot drift away from the bytes. Returns null when the message is not
 * the shape this summary knows how to read: the caller must then refuse rather
 * than sign something it cannot describe.
 */
export const summariseWasmMsg = (
  msgType: MsgTypeUrl,
  msg: EncodeObject | EncodeObject[],
): IntentSummary | null => {
  const messages = Array.isArray(msg) ? msg : [msg];
  const single = messages.length === 1 ? messages[0] : undefined;
  if (!single || single.typeUrl !== msgType) return null;

  if (msgType === MsgTypeUrls.UpdateAdmin) {
    return summariseUpdateAdmin(single.value as MsgUpdateAdmin);
  }
  if (msgType === MsgTypeUrls.MigrateContract) {
    return summariseMigrateContract(single.value as MsgMigrateContract);
  }
  return null;
};
