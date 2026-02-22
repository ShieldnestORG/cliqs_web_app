/**
 * Phase 3: Proposal Generator
 *
 * File: tests/phase3/generators/genProposal.ts
 *
 * Generates randomized proposals for lifecycle fuzzing.
 * Tests state machine transitions, vote sequences, and execution paths.
 */

import type { ProposalState } from "../oracle/invariantOracle";

// ============================================================================
// TYPES
// ============================================================================

export interface GeneratedProposal {
  id: string;
  title: string;
  description: string;
  messages: GeneratedMessage[];
  fee: {
    amount: Array<{ denom: string; amount: string }>;
    gas: string;
  };
  memo: string;
  creator: string;
  voters: string[];
  threshold: number;
  createdAt: number;
  expiresAt: number;
  timelock?: {
    unlockAtMs: number;
  };
  currentState: ProposalState;
  stateHistory: ProposalState[];
  _generator: string;
  _seed: number;
}

export interface GeneratedMessage {
  typeUrl: string;
  value: Record<string, unknown>;
}

export type ProposalAction =
  | "CREATE"
  | "VOTE_APPROVE"
  | "VOTE_REJECT"
  | "EXECUTE"
  | "EXPIRE"
  | "CANCEL"
  | "FAIL";

// ============================================================================
// RANDOM UTILITIES
// ============================================================================

let seededRandom: (() => number) | null = null;

export function setSeed(seed: number): void {
  let s = seed;
  seededRandom = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

export function resetRandom(): void {
  seededRandom = null;
}

function rand(): number {
  return seededRandom ? seededRandom() : Math.random();
}

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
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

function randHex(length: number): string {
  const chars = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(rand() * chars.length)];
  }
  return result;
}

// ============================================================================
// MESSAGE GENERATORS
// ============================================================================

function genMsgSend(): GeneratedMessage {
  return {
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: {
      fromAddress: randBech32("cosmos"),
      toAddress: randBech32("cosmos"),
      amount: [{ denom: "ucore", amount: String(randInt(1, 1000000)) }],
    },
  };
}

function genMsgDelegate(): GeneratedMessage {
  return {
    typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
    value: {
      delegatorAddress: randBech32("cosmos"),
      validatorAddress: randBech32("cosmosvaloper"),
      amount: { denom: "ucore", amount: String(randInt(1, 1000000)) },
    },
  };
}

function genMsgUndelegate(): GeneratedMessage {
  return {
    typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate",
    value: {
      delegatorAddress: randBech32("cosmos"),
      validatorAddress: randBech32("cosmosvaloper"),
      amount: { denom: "ucore", amount: String(randInt(1, 1000000)) },
    },
  };
}

function genMsgWithdrawRewards(): GeneratedMessage {
  return {
    typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    value: {
      delegatorAddress: randBech32("cosmos"),
      validatorAddress: randBech32("cosmosvaloper"),
    },
  };
}

function genMsgExecuteContract(): GeneratedMessage {
  return {
    typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
    value: {
      sender: randBech32("cosmos"),
      contract: randBech32("cosmos"),
      msg: { transfer: { recipient: randBech32("cosmos"), amount: String(randInt(1, 1000)) } },
      funds: [],
    },
  };
}

function genMsgIbcTransfer(): GeneratedMessage {
  return {
    typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
    value: {
      sourcePort: "transfer",
      sourceChannel: `channel-${randInt(0, 100)}`,
      token: { denom: "ucore", amount: String(randInt(1, 1000000)) },
      sender: randBech32("cosmos"),
      receiver: randBech32("cosmos"),
      timeoutHeight: { revisionNumber: "0", revisionHeight: "0" },
      timeoutTimestamp: String(Date.now() + 86400000),
    },
  };
}

function genRandomMessage(): GeneratedMessage {
  const generators = [
    genMsgSend,
    genMsgDelegate,
    genMsgUndelegate,
    genMsgWithdrawRewards,
    genMsgExecuteContract,
    genMsgIbcTransfer,
  ];
  return randChoice(generators)();
}

// ============================================================================
// PROPOSAL GENERATORS
// ============================================================================

/**
 * Generate a random proposal
 */
export function genProposal(seed?: number): GeneratedProposal {
  if (seed !== undefined) setSeed(seed);

  const nowMs = Date.now();
  const numMessages = randInt(1, 5);
  const numVoters = randInt(3, 7);
  const threshold = randInt(2, numVoters);

  return {
    id: `proposal_${randHex(8)}`,
    title: `Test Proposal ${randInt(1, 1000)}`,
    description: `Generated proposal for fuzzing testing`,
    messages: Array.from({ length: numMessages }, genRandomMessage),
    fee: {
      amount: [{ denom: "ucore", amount: String(randInt(1000, 10000)) }],
      gas: String(randInt(100000, 500000)),
    },
    memo: `Fuzz test memo ${randHex(4)}`,
    creator: randBech32("cosmos"),
    voters: Array.from({ length: numVoters }, () => randBech32("cosmos")),
    threshold,
    createdAt: nowMs,
    expiresAt: nowMs + randChoice([86400000, 604800000, 2592000000]), // 1d, 7d, 30d
    timelock: rand() > 0.5 ? { unlockAtMs: nowMs + randInt(-3600000, 3600000) } : undefined,
    currentState: "DRAFT",
    stateHistory: ["DRAFT"],
    _generator: "genProposal",
    _seed: seed ?? -1,
  };
}

/**
 * Generate a proposal ready for execution
 */
export function genExecutableProposal(seed?: number): GeneratedProposal {
  const base = genProposal(seed);
  return {
    ...base,
    currentState: "EXECUTABLE",
    stateHistory: ["DRAFT", "OPEN", "APPROVED", "EXECUTABLE"],
    timelock: { unlockAtMs: Date.now() - 3600000 }, // Already unlocked
    _generator: "genExecutableProposal",
  };
}

/**
 * Generate an already executed proposal (for replay testing)
 */
export function genExecutedProposal(seed?: number): GeneratedProposal {
  const base = genExecutableProposal(seed);
  return {
    ...base,
    currentState: "EXECUTED",
    stateHistory: [...base.stateHistory, "EXECUTED"],
    _generator: "genExecutedProposal",
  };
}

// ============================================================================
// ACTION SEQUENCE GENERATORS
// ============================================================================

/**
 * Generate a valid action sequence for a proposal
 */
export function genValidActionSequence(proposal: GeneratedProposal): ProposalAction[] {
  const actions: ProposalAction[] = ["CREATE"];

  // Collect enough votes
  for (let i = 0; i < proposal.threshold; i++) {
    actions.push("VOTE_APPROVE");
  }

  actions.push("EXECUTE");
  return actions;
}

/**
 * Generate a random (potentially invalid) action sequence
 */
export function genRandomActionSequence(length: number, seed?: number): ProposalAction[] {
  if (seed !== undefined) setSeed(seed);

  const allActions: ProposalAction[] = [
    "CREATE",
    "VOTE_APPROVE",
    "VOTE_REJECT",
    "EXECUTE",
    "EXPIRE",
    "CANCEL",
    "FAIL",
  ];

  // For fuzzing, we want to include some invalid transitions to test error handling
  // But most should be reasonable
  return Array.from({ length }, () => {
    // 80% chance of valid-ish actions, 20% chance of any action (including invalid)
    if (rand() < 0.8) {
      const reasonableActions: ProposalAction[] = [
        "CREATE", "VOTE_APPROVE", "VOTE_REJECT", "EXECUTE"
      ];
      return randChoice(reasonableActions);
    } else {
      return randChoice(allActions);
    }
  });
}

/**
 * Generate hostile action sequences for adversarial testing
 */
export function genHostileActionSequence(type: string, seed?: number): ProposalAction[] {
  if (seed !== undefined) setSeed(seed);

  switch (type) {
    case "double_execute":
      // Needs 3 EXECUTEs: APPROVED→EXECUTABLE, EXECUTABLE→EXECUTED, EXECUTED→(error)
      return ["CREATE", "VOTE_APPROVE", "VOTE_APPROVE", "EXECUTE", "EXECUTE", "EXECUTE"];

    case "execute_without_votes":
      return ["CREATE", "EXECUTE"];

    case "vote_after_execute":
      return ["CREATE", "VOTE_APPROVE", "VOTE_APPROVE", "EXECUTE", "VOTE_APPROVE"];

    case "cancel_after_execute":
      return ["CREATE", "VOTE_APPROVE", "VOTE_APPROVE", "EXECUTE", "CANCEL"];

    case "race_condition":
      return ["CREATE", "VOTE_APPROVE", "EXECUTE", "VOTE_APPROVE", "EXECUTE"];

    case "rapid_fire":
      return Array(20).fill("EXECUTE");

    default:
      return genRandomActionSequence(randInt(5, 15), seed);
  }
}

// ============================================================================
// STATE MACHINE SIMULATOR
// ============================================================================

/**
 * Apply an action to a proposal and return the new state
 */
export function applyAction(
  proposal: GeneratedProposal,
  action: ProposalAction,
  context: { votesCollected: number; nowMs: number }
): { newState: ProposalState; error?: string } {
  const currentState = proposal.currentState;

  // INVARIANT: Terminal states cannot transition
  const TERMINAL_STATES: Set<ProposalState> = new Set(["EXECUTED", "FAILED", "REJECTED", "EXPIRED"]);
  if (TERMINAL_STATES.has(currentState)) {
    return { newState: currentState, error: `Cannot ${action}: proposal is already in terminal state ${currentState}. INVARIANT: Terminal states are immutable` };
  }

  switch (action) {
    case "CREATE":
      if (currentState !== "DRAFT") {
        return { newState: currentState, error: "Cannot create: not in DRAFT state" };
      }
      return { newState: "OPEN" };

    case "VOTE_APPROVE":
      if (currentState !== "OPEN") {
        return { newState: currentState, error: "Cannot vote: not in OPEN state" };
      }
      context.votesCollected++;
      if (context.votesCollected >= proposal.threshold) {
        return { newState: "APPROVED" };
      }
      return { newState: "OPEN" };

    case "VOTE_REJECT":
      if (currentState !== "OPEN") {
        return { newState: currentState, error: "Cannot vote: not in OPEN state" };
      }
      return { newState: "REJECTED" };

    case "EXECUTE":
      if (currentState === "EXECUTED") {
        return { newState: currentState, error: "INVARIANT: Cannot execute twice" };
      }
      // EXECUTE only from EXECUTABLE state (APPROVED must first become EXECUTABLE)
      if (currentState !== "EXECUTABLE") {
        if (currentState === "APPROVED") {
          // Auto-transition APPROVED → EXECUTABLE if timelock is expired
          if (!proposal.timelock || context.nowMs >= proposal.timelock.unlockAtMs) {
            return { newState: "EXECUTABLE" };
          }
          return { newState: currentState, error: "Timelock not expired" };
        }
        return { newState: currentState, error: "Cannot execute: not in executable state" };
      }
      // Check timelock
      if (proposal.timelock && context.nowMs < proposal.timelock.unlockAtMs) {
        return { newState: currentState, error: "Timelock not expired" };
      }
      return { newState: "EXECUTED" };

    case "EXPIRE":
      if (currentState === "EXECUTED" || currentState === "FAILED" || currentState === "REJECTED" || currentState === "EXPIRED") {
        return { newState: currentState, error: "Cannot expire: already terminal" };
      }
      // EXPIRE only valid from OPEN, APPROVED, EXECUTABLE states (not DRAFT)
      if (currentState === "DRAFT") {
        return { newState: currentState, error: "Cannot expire: proposal not yet open" };
      }
      return { newState: "EXPIRED" };

    case "CANCEL":
      if (currentState === "EXECUTED" || currentState === "FAILED" || currentState === "REJECTED" || currentState === "EXPIRED") {
        return { newState: currentState, error: "Cannot cancel: already terminal" };
      }
      // CANCEL/FAIL only valid from DRAFT, OPEN states
      if (currentState !== "DRAFT" && currentState !== "OPEN") {
        return { newState: currentState, error: "Cannot cancel: proposal already past open state" };
      }
      return { newState: "FAILED" };

    case "FAIL":
      if (TERMINAL_STATES.has(currentState)) {
        return { newState: currentState, error: "Cannot fail: already terminal" };
      }
      return { newState: "FAILED" };

    default:
      return { newState: currentState, error: `Unknown action: ${action}` };
  }
}

/**
 * Simulate a full action sequence and return the state history
 */
export function simulateActionSequence(
  proposal: GeneratedProposal,
  actions: ProposalAction[]
): { history: ProposalState[]; errors: string[] } {
  const history: ProposalState[] = [proposal.currentState];
  const errors: string[] = [];
  const context = { votesCollected: 0, nowMs: Date.now() };

  let currentProposal = { ...proposal };

  for (const action of actions) {
    const result = applyAction(currentProposal, action, context);
    if (result.error) {
      errors.push(result.error);
    }
    if (result.newState !== currentProposal.currentState) {
      history.push(result.newState);
      currentProposal = { ...currentProposal, currentState: result.newState };
    }
  }

  return { history, errors };
}

/**
 * Generate a batch of proposals with various states
 */
export function genProposalBatch(count: number, seed?: number): GeneratedProposal[] {
  const proposals: GeneratedProposal[] = [];

  for (let i = 0; i < count; i++) {
    const itemSeed = seed !== undefined ? seed + i : undefined;
    const type = i % 3;

    switch (type) {
      case 0:
        proposals.push(genProposal(itemSeed));
        break;
      case 1:
        proposals.push(genExecutableProposal(itemSeed));
        break;
      case 2:
        proposals.push(genExecutedProposal(itemSeed));
        break;
    }
  }

  return proposals;
}

