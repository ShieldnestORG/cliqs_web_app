import { RNG } from "./rng";
import { genAmount, genBech32LikeAddress, genDenom } from "./chainPrimitives";

export type CosmosMsg =
  | { type: "bank/send"; value: { fromAddress: string; toAddress: string; amount: { denom: string; amount: string }[] } }
  | { type: "staking/delegate"; value: { delegatorAddress: string; validatorAddress: string; amount: { denom: string; amount: string } } }
  | { type: "staking/undelegate"; value: { delegatorAddress: string; validatorAddress: string; amount: { denom: string; amount: string } } }
  | { type: "distribution/withdraw_rewards"; value: { delegatorAddress: string; validatorAddress: string } }
  | { type: "distribution/withdraw_validator_commission"; value: { validatorAddress: string } }
  | { type: "wasm/execute"; value: { contract: string; msg: any; funds: { denom: string; amount: string }[] } }
  | { type: "custom/unknown"; value: any };

export const COSMOS_MSG_TYPES = [
  "bank/send",
  "staking/delegate",
  "staking/undelegate",
  "distribution/withdraw_rewards",
  "distribution/withdraw_validator_commission",
  "wasm/execute",
] as const;

export function genAllowedMsg(rng: RNG): CosmosMsg {
  const type = rng.pick([...COSMOS_MSG_TYPES]);

  switch (type) {
    case "bank/send":
      return {
        type,
        value: {
          fromAddress: genBech32LikeAddress(rng),
          toAddress: genBech32LikeAddress(rng),
          amount: [{ denom: genDenom(rng), amount: genAmount(rng) }],
        },
      };

    case "staking/delegate":
    case "staking/undelegate":
      return {
        type,
        value: {
          delegatorAddress: genBech32LikeAddress(rng),
          validatorAddress: genBech32LikeAddress(rng, [
            "cosmosvaloper",
            "corevaloper",
            "osmovaloper",
          ]),
          amount: { denom: genDenom(rng), amount: genAmount(rng) },
        },
      };

    case "distribution/withdraw_rewards":
      return {
        type,
        value: {
          delegatorAddress: genBech32LikeAddress(rng),
          validatorAddress: genBech32LikeAddress(rng, [
            "cosmosvaloper",
            "corevaloper",
            "osmovaloper",
          ]),
        },
      };

    case "distribution/withdraw_validator_commission":
      return {
        type,
        value: {
          validatorAddress: genBech32LikeAddress(rng, [
            "cosmosvaloper",
            "corevaloper",
            "osmovaloper",
          ]),
        },
      };

    case "wasm/execute":
      return {
        type,
        value: {
          contract: genBech32LikeAddress(rng),
          msg: { action: "noop", data: rng.int(0, 9999) },
          funds: rng.bool(0.3) ? [{ denom: genDenom(rng), amount: genAmount(rng) }] : [],
        },
      };

    default:
      // fallback
      return {
        type: "bank/send",
        value: {
          fromAddress: genBech32LikeAddress(rng),
          toAddress: genBech32LikeAddress(rng),
          amount: [{ denom: genDenom(rng), amount: genAmount(rng) }],
        },
      };
  }
}

export function genDisallowedMsg(rng: RNG): CosmosMsg {
  // used to validate msg-type restriction policies
  return {
    type: "custom/unknown",
    value: { weird: "payload", n: rng.int(0, 9999), data: genBech32LikeAddress(rng) },
  };
}

export function genMsgBatch(rng: RNG, opts?: { maxMsgs?: number; includeDisallowedChance?: number }): CosmosMsg[] {
  const maxMsgs = opts?.maxMsgs ?? 10;
  const includeDisallowedChance = opts?.includeDisallowedChance ?? 0.05;

  const n = rng.int(1, maxMsgs);
  const msgs: CosmosMsg[] = [];
  for (let i = 0; i < n; i++) {
    msgs.push(rng.bool(includeDisallowedChance) ? genDisallowedMsg(rng) : genAllowedMsg(rng));
  }
  return msgs;
}
