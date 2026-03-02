/**
 * Phase 3: Policy Context Generator
 *
 * File: tests/phase3/generators/genPolicyCtx.ts
 *
 * Generates randomized, adversarial policy contexts for fuzzing.
 * Produces both valid and hostile inputs to test policy evaluation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedPolicyContext {
  // Emergency controls
  emergencyPaused: boolean;
  safeMode: boolean;

  // Policy versioning
  policyVersion: number;
  expectedPolicyVersion: number;

  // Timelock
  timelock: {
    unlockAtMs: number;
    createdAtMs: number;
    delayMs: number;
  };

  // Spend tracking
  spend: Array<{
    amount: string;
    denom: string;
  }>;
  spendLimit: Array<{
    amount: string;
    denom: string;
  }>;

  // Credentials
  credential: {
    holder: string;
    valid: boolean;
    role: "admin" | "member" | "readonly" | "unknown";
    version: number;
  };

  // Timing
  nowMs: number;
  currentHeight: number;

  // Multi-sig thresholds
  signaturesRequired: number;
  signaturesCollected: number;
  totalSigners: number;

  // Chain context
  chainId: string;
  multisigAddress: string;

  // Message types (for type-based policies)
  messageTypes: string[];

  // Metadata
  _generator: string;
  _seed: number;
}

// ============================================================================
// RANDOM UTILITIES
// ============================================================================

let seededRandom: (() => number) | null = null;

/**
 * Set a deterministic seed for reproducible fuzzing
 */
export function setSeed(seed: number): void {
  let s = seed;
  seededRandom = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * Reset to Math.random for non-deterministic fuzzing
 */
export function resetRandom(): void {
  seededRandom = null;
}

function rand(): number {
  return seededRandom ? seededRandom() : Math.random();
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function randBool(probability = 0.5): boolean {
  return rand() < probability;
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function randBech32(prefix = "cosmos"): string {
  const chars = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
  let addr = prefix + "1";
  for (let i = 0; i < 38; i++) {
    addr += chars[Math.floor(rand() * chars.length)];
  }
  return addr;
}

// ============================================================================
// GENERATORS
// ============================================================================

/**
 * Generate a completely random policy context
 *
 * Use this for broad fuzzing coverage
 */
export function genPolicyCtx(seed?: number): GeneratedPolicyContext {
  if (seed !== undefined) setSeed(seed);

  const nowMs = Date.now();
  const unlockOffset = randInt(-86400000, 86400000); // ±1 day

  return {
    // Emergency controls (10% chance each)
    emergencyPaused: randBool(0.1),
    safeMode: randBool(0.1),

    // Policy versioning (15% chance of mismatch)
    policyVersion: randChoice([1, 1, 1, 1, 2, 3]),
    expectedPolicyVersion: 1,

    // Timelock
    timelock: {
      unlockAtMs: nowMs + unlockOffset,
      createdAtMs: nowMs - 86400000,
      delayMs: randChoice([0, 3600000, 86400000, 604800000]),
    },

    // Spend tracking (random amounts)
    spend: Array.from({ length: randInt(0, 3) }, () => ({
      amount: String(randInt(0, 5000)),
      denom: randChoice(["ucore", "utestcore", "uatom", "uosmo"]),
    })),
    spendLimit: [
      { amount: "1000", denom: "ucore" },
      { amount: "500", denom: "utestcore" },
    ],

    // Credentials (20% chance invalid)
    credential: {
      holder: randBech32("cosmos"),
      valid: randBool(0.8),
      role: randChoice(["admin", "member", "member", "member", "readonly", "unknown"]),
      version: randChoice([1, 1, 1, 2]),
    },

    // Timing
    nowMs,
    currentHeight: randInt(1000000, 2000000),

    // Multi-sig thresholds
    signaturesRequired: randChoice([2, 3, 4, 5]),
    signaturesCollected: randInt(0, 5),
    totalSigners: randInt(3, 7),

    // Chain context
    chainId: randChoice(["cosmoshub-4", "coreum-mainnet-1", "coreum-testnet-1", "osmosis-1"]),
    multisigAddress: randBech32("cosmos"),

    // Message types
    messageTypes: randChoice([
      ["/cosmos.bank.v1beta1.MsgSend"],
      ["/cosmos.staking.v1beta1.MsgDelegate"],
      ["/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"],
      ["/cosmwasm.wasm.v1.MsgExecuteContract"],
      ["/cosmos.bank.v1beta1.MsgMultiSend"],
      ["/ibc.applications.transfer.v1.MsgTransfer"],
    ]),

    // Metadata
    _generator: "genPolicyCtx",
    _seed: seed ?? -1,
  };
}

/**
 * Generate a valid policy context (should always pass policies)
 */
export function genValidPolicyCtx(seed?: number): GeneratedPolicyContext {
  if (seed !== undefined) setSeed(seed);

  const nowMs = Date.now();

  return {
    emergencyPaused: false,
    safeMode: false,
    policyVersion: 1,
    expectedPolicyVersion: 1,
    timelock: {
      unlockAtMs: nowMs - 3600000, // Already unlocked
      createdAtMs: nowMs - 86400000,
      delayMs: 3600000,
    },
    spend: [{ amount: "100", denom: "ucore" }],
    spendLimit: [{ amount: "1000", denom: "ucore" }],
    credential: {
      holder: randBech32("cosmos"),
      valid: true,
      role: "member",
      version: 1,
    },
    nowMs,
    currentHeight: randInt(1000000, 2000000),
    signaturesRequired: 2,
    signaturesCollected: 2,
    totalSigners: 3,
    chainId: "coreum-testnet-1",
    multisigAddress: randBech32("cosmos"),
    messageTypes: ["/cosmos.bank.v1beta1.MsgSend"],
    _generator: "genValidPolicyCtx",
    _seed: seed ?? -1,
  };
}

/**
 * Generate a hostile policy context (should always fail policies)
 */
export function genHostilePolicyCtx(seed?: number): GeneratedPolicyContext {
  if (seed !== undefined) setSeed(seed);

  const nowMs = Date.now();
  const hostileType = randChoice([
    "emergency_paused",
    "safe_mode",
    "version_mismatch",
    "timelock_active",
    "spend_exceeded",
    "invalid_credential",
    "insufficient_signatures",
    "all_hostile",
  ]);

  const base = genValidPolicyCtx(seed);

  switch (hostileType) {
    case "emergency_paused":
      return { ...base, emergencyPaused: true, _generator: "genHostilePolicyCtx:emergency" };

    case "safe_mode":
      return { ...base, safeMode: true, _generator: "genHostilePolicyCtx:safemode" };

    case "version_mismatch":
      return {
        ...base,
        policyVersion: 2,
        expectedPolicyVersion: 1,
        _generator: "genHostilePolicyCtx:version",
      };

    case "timelock_active":
      return {
        ...base,
        timelock: {
          ...base.timelock,
          unlockAtMs: nowMs + 86400000, // 1 day in future
        },
        _generator: "genHostilePolicyCtx:timelock",
      };

    case "spend_exceeded":
      return {
        ...base,
        spend: [{ amount: "9999999", denom: "ucore" }],
        spendLimit: [{ amount: "1000", denom: "ucore" }],
        _generator: "genHostilePolicyCtx:spend",
      };

    case "invalid_credential":
      return {
        ...base,
        credential: { ...base.credential, valid: false },
        _generator: "genHostilePolicyCtx:credential",
      };

    case "insufficient_signatures":
      return {
        ...base,
        signaturesRequired: 5,
        signaturesCollected: 2,
        _generator: "genHostilePolicyCtx:signatures",
      };

    case "all_hostile":
    default:
      return {
        ...base,
        emergencyPaused: true,
        safeMode: true,
        policyVersion: 99,
        timelock: { ...base.timelock, unlockAtMs: nowMs + 999999999 },
        spend: [{ amount: "999999999", denom: "ucore" }],
        credential: { ...base.credential, valid: false },
        signaturesRequired: 10,
        signaturesCollected: 0,
        _generator: "genHostilePolicyCtx:all_hostile",
      };
  }
}

/**
 * Generate boundary test cases (edge cases)
 */
export function genBoundaryPolicyCtx(seed?: number): GeneratedPolicyContext {
  if (seed !== undefined) setSeed(seed);

  const nowMs = Date.now();
  const boundaryType = randChoice([
    "exact_timelock",
    "exact_spend_limit",
    "exact_threshold",
    "zero_spend",
    "max_spend",
    "version_boundary",
  ]);

  const base = genValidPolicyCtx(seed);

  switch (boundaryType) {
    case "exact_timelock":
      return {
        ...base,
        timelock: { ...base.timelock, unlockAtMs: nowMs },
        _generator: "genBoundaryPolicyCtx:exact_timelock",
      };

    case "exact_spend_limit":
      return {
        ...base,
        spend: [{ amount: "1000", denom: "ucore" }],
        spendLimit: [{ amount: "1000", denom: "ucore" }],
        _generator: "genBoundaryPolicyCtx:exact_spend",
      };

    case "exact_threshold":
      return {
        ...base,
        signaturesRequired: 3,
        signaturesCollected: 3,
        _generator: "genBoundaryPolicyCtx:exact_threshold",
      };

    case "zero_spend":
      return {
        ...base,
        spend: [],
        _generator: "genBoundaryPolicyCtx:zero_spend",
      };

    case "max_spend":
      return {
        ...base,
        spend: [{ amount: String(Number.MAX_SAFE_INTEGER), denom: "ucore" }],
        _generator: "genBoundaryPolicyCtx:max_spend",
      };

    case "version_boundary":
    default:
      return {
        ...base,
        policyVersion: 0,
        expectedPolicyVersion: 0,
        _generator: "genBoundaryPolicyCtx:version_zero",
      };
  }
}

/**
 * Generate a batch of diverse policy contexts for comprehensive testing
 */
export function genPolicyCtxBatch(count: number, seed?: number): GeneratedPolicyContext[] {
  const contexts: GeneratedPolicyContext[] = [];

  for (let i = 0; i < count; i++) {
    const itemSeed = seed !== undefined ? seed + i : undefined;
    const type = i % 4;

    switch (type) {
      case 0:
        contexts.push(genPolicyCtx(itemSeed));
        break;
      case 1:
        contexts.push(genValidPolicyCtx(itemSeed));
        break;
      case 2:
        contexts.push(genHostilePolicyCtx(itemSeed));
        break;
      case 3:
        contexts.push(genBoundaryPolicyCtx(itemSeed));
        break;
    }
  }

  return contexts;
}
