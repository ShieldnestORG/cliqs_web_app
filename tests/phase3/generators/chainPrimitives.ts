import { RNG } from "./rng";

export function genDenom(rng: RNG): string {
  return rng.pick([
    "uatom",
    "ucore",
    "uosmo",
    "ujuno",
    "usei",
    "ukuji",
    `ibc/${rng.nextU32().toString(16).padStart(64, "0")}`,
  ]);
}

export function genAmount(rng: RNG, opts?: { max?: number; min?: number }): string {
  const min = opts?.min ?? 1;
  const max = opts?.max ?? 10_000_000;
  const n = rng.int(min, max);
  return String(n); // Cosmos SDK amounts are string ints
}

export function genBech32LikeAddress(
  rng: RNG,
  prefixes = ["cosmos", "core", "osmo", "juno", "inj", "kujira", "sei"],
): string {
  const prefix = rng.pick(prefixes);
  const charset = "023456789acdefghjklmnpqrstuvwxyz";
  let data = "";
  const len = rng.int(35, 42);
  for (let i = 0; i < len; i++) data += charset[rng.int(0, charset.length - 1)];
  return `${prefix}1${data}`;
}

export function genMemo(rng: RNG, maxLen = 64): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_:.";
  const len = rng.int(0, maxLen);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[rng.int(0, chars.length - 1)];
  return out;
}
