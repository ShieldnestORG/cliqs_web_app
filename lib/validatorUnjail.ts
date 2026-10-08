/**
 * Validator Unjail Gating
 *
 * File: lib/validatorUnjail.ts
 *
 * Pure rule behind the "Unjail validator" action: should it show, and may it be pressed?
 * The chain is the final judge (MsgUnjail fails while blockTime < jailed_until and for a
 * tombstoned validator); this keeps a CLIQ from proposing a transaction that cannot succeed.
 */

import { ValidatorSigningInfo } from "@/lib/validatorHelpers";

export type UnjailGate =
  /** Not jailed: show nothing */
  | { status: "hidden" }
  /** Tombstoned (double-sign): can never be unjailed */
  | { status: "tombstoned" }
  /** Still inside the jail period: unjail only becomes possible at `until` */
  | { status: "waiting"; until: Date }
  /** Signing info could not be read: the button stays usable, the chain decides */
  | { status: "unverified" }
  /** Jail period over: may be unjailed */
  | { status: "ready" };

export function getUnjailGate({
  jailed,
  signingInfo,
  now,
}: {
  jailed: boolean;
  signingInfo: ValidatorSigningInfo | null;
  now: Date;
}): UnjailGate {
  if (!jailed) {
    return { status: "hidden" };
  }
  if (!signingInfo) {
    return { status: "unverified" };
  }
  // Check tombstoned first: a tombstoned validator also carries a far-future jailed_until
  // (9999-12-31), and "wait until 9999" would be the wrong message.
  if (signingInfo.tombstoned) {
    return { status: "tombstoned" };
  }
  // The chain rejects only while blockTime < jailed_until, so equality is already allowed.
  if (signingInfo.jailedUntil && signingInfo.jailedUntil.getTime() > now.getTime()) {
    return { status: "waiting", until: signingInfo.jailedUntil };
  }
  return { status: "ready" };
}

/** "2026-10-08 17:03 UTC": unambiguous across the signers' time zones */
export function formatJailedUntil(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
