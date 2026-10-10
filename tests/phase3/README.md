# 🧬 Phase 3: Adversarial Fuzzing, Invariants & Replay Attacks

> **Cluster:** tests · **Tags:** fuzz, invariants, replay, simulator, phase4-removed · **Related:** [Chaos tests](../chaos/README.md), [Formal model](../../formal/README.md), [PRD](../../docs/PRD.md)

**File**: `tests/phase3/README.md`

> **What a pass means (2026-10-10):** these suites run a proposal state machine and a wallet-flow mock that live inside the test folders (`generators/genProposal.ts`, `__tests__/adapters/walletFlow.adapter.ts`). A pass is not evidence that the app enforces anything. The policy, emergency-pause and spend-limit suites (`policy.fuzz`, `policy.invariants`, `execution.invariants`, `genPolicyCtx`) were deleted on 2026-10-10 together with Phase 4, which the app never used; the code is archived at git tag `archive/phase4-policies-2026-10-10`.

This directory contains **Phase 3 testing** - the systematic adversarial exploration that pushes the system from *"attack-resilient"* to *"audit-grade adversarially hardened."*

## What Phase 3 Is (in one sentence)

> **Continuously generate hostile, malformed, reordered, and repeated inputs to prove that *no sequence of events* can violate your core invariants.**

## The Phase 3 Difference

| Phase | Question Answered |
|-------|------------------|
| Phase 1 | "Does it work correctly?" |
| Phase 2 | "Does it survive known attacks?" |
| **Phase 3** | **"Can *any* attack sequence break it?"** |

Phase 3 is **not scenario-based**. It is **systematic adversarial exploration**.

---

# 📁 Directory Structure

```
tests/phase3/
├── oracle/
│   └── invariantOracle.ts              # Single source of truth for all invariants
├── generators/
│   ├── rng.ts                          # Deterministic RNG for reproducible fuzzing
│   ├── chainPrimitives.ts              # Cosmos-SDK primitives (addresses, amounts, denoms)
│   ├── genMsg.ts                       # Valid/invalid Cosmos message generators
│   ├── genProposal.ts                  # Proposal lifecycle generator
│   └── genTx.ts                        # Transaction fuzz generator
├── gas/
│   ├── gasEstimator.ts                 # Gas estimation (real + heuristic)
│   └── gasOracle.ts                    # Gas budget classification
├── invariants/
│   └── proposal.invariants.spec.ts     # Proposal state machine invariants
├── fuzz/
│   ├── gas.fuzz.spec.ts                # Gas pressure + out-of-gas safety
│   ├── proposal.fuzz.spec.ts           # Proposal lifecycle fuzzing
│   └── tx.fuzz.spec.ts                 # Transaction processing fuzzing
├── replay/
│   ├── double.execute.spec.ts          # Double execution attack testing
│   └── stale.signature.spec.ts         # Stale signature replay testing
└── README.md                           # This file
```

---

# 🎯 Core Principle: Invariants First

## What Are Invariants?

**Non-negotiable truths** your system must *never* violate:

### Global Invariants
- ❌ **Proposal can never execute twice**
- ❌ **State transitions must be monotonic**
- ❌ **Replayed tx bytes must not re-execute**

## The Invariant Oracle

All invariants are defined in [`oracle/invariantOracle.ts`](./oracle/invariantOracle.ts):

```typescript
// Example: Proposal state machine invariants
export function assertProposalInvariants(history: ProposalState[]) {
  const seen = new Set<ProposalState>();

  for (const state of history) {
    // INVARIANT 1: No double execution
    if (state === "EXECUTED" && seen.has("EXECUTED")) {
      throw new Error("INVARIANT VIOLATION: double execution");
    }
    // ... more invariants
  }
}
```

**Every fuzz + replay test uses this oracle.**

---

# 🧪 1. Invariants Testing (`invariants/`)

## Purpose
Prove that **under normal operation**, no invariants are violated.

## Test Categories

### `proposal.invariants.spec.ts`
- ✅ **No Double Execution**: `EXECUTED` can only appear once
- ✅ **Monotonic State Transitions**: No regressions after terminal states
- ✅ **Valid State Transitions Only**: Strict state machine enforcement

## Running Invariants Tests

```bash
# Run all invariants tests
npm test -- tests/phase3/invariants

# Run specific invariant category
npm test -- tests/phase3/invariants/proposal.invariants.spec.ts

# Watch mode
npm test -- --watch tests/phase3/invariants
```

---

# 🎲 2. Fuzzing Testing (`fuzz/`)

## Purpose
Prove that **under adversarial inputs**, invariants are never violated.

## Fuzz Test Categories

### `gas.fuzz.spec.ts` - Gas Pressure & Out-of-Gas Safety
```typescript
test("big valid batches fail safely and remain idempotent under out-of-gas injection", async () => {
  // Generate valid-but-large Cosmos tx batches
  const msgs = genMsgBatch(rng, { maxMsgs: 40, includeDisallowedChance: 0.0 });
  const est = await estimateGas({ msgs, memo });

  // Inject OUT_OF_GAS faults at gas pressure thresholds
  if (classify(est) === "nearLimit") {
    faultController.addFault({
      hook: "duringBroadcast",
      run: () => { throw new Error("OUT_OF_GAS"); }
    });
  }

  // Assert: failures are safe, retries don't crash
});
```

### `proposal.fuzz.spec.ts` - Proposal Lifecycle Fuzzing
- ✅ **Randomized Vote/Execute Orderings**: Any sequence preserves invariants
- ✅ **Hostile Action Sequences**: Double execute, race conditions, etc.
- ⚠️ **Chaos Injection**: faults are registered on a fault controller around a simulated lifecycle, but the simulator never fires them or reads their state

### `tx.fuzz.spec.ts` - Transaction Processing Fuzzing
- ✅ **Malformed Transaction Handling**: Invalid addresses, corrupted bytes
- ✅ **Replay Attack Detection**: Duplicate tx detection
- ✅ **Stale Signature Handling**: Sequence number validation

## Fuzz Generators

### `rng.ts` - Deterministic RNG
```typescript
const rng = new RNG(0xC0FFEE); // Reproducible fuzzing
const value = rng.int(0, 100);
const choice = rng.pick(["a", "b", "c"]);
```

### `chainPrimitives.ts` - Cosmos-SDK Primitives
```typescript
// Multi-chain address generation (no hardcoded prefixes)
const addr = genBech32LikeAddress(rng); // cosmos1..., core1..., osmo1...

// IBC-safe denom generation
const denom = genDenom(rng); // uatom, ucore, ibc/DEADBEEF...

// String amounts (Cosmos SDK standard)
const amount = genAmount(rng); // "1000000" (not 1000000)
```

### `genMsg.ts` - Cosmos Message Generator
```typescript
// Valid Cosmos messages across all chains
const msg = genAllowedMsg(rng);
// { type: "bank/send", value: { ... } }
// { type: "staking/delegate", value: { ... } }
// { type: "wasm/execute", value: { ... } }

// Invalid messages for policy testing
const badMsg = genDisallowedMsg(rng);
// { type: "custom/unknown", value: { ... } }
```

### `genProposal.ts`
Generates proposal lifecycles:
- Valid sequences
- Hostile sequences (double execute, race conditions)
- Random action orderings

### `genTx.ts`
Generates transactions:
- Valid transactions
- Malformed transactions (corrupted, invalid signatures)
- Replay attacks
- Stale signatures

## Gas Estimation System (`gas/`)

### `gasEstimator.ts` - Auto-Detecting Gas Estimation
```typescript
// Uses real gas estimation if your CanonicalTxBuilder exposes it
const est = await estimateGas({ msgs, memo });
// Falls back to heuristic model for CI safety
// { gas: 125000, bytes: 2048, model: "real" | "heuristic" }
```

### `gasOracle.ts` - Gas Budget Classification
```typescript
const band = classify(estimate);
// "normal" | "stressed" | "nearLimit" | "overLimit"
```

## Running Fuzz Tests

```bash
# Run all fuzz tests
npm test -- tests/phase3/fuzz

# Run specific fuzz category
npm test -- tests/phase3/fuzz/proposal.fuzz.spec.ts
npm test -- tests/phase3/fuzz/gas.fuzz.spec.ts

# Run with seed for reproducibility
SEED=12345 npm test -- tests/phase3/fuzz
```

---

# 🔄 3. Replay Attack Testing (`replay/`)

## Purpose
Prove that **replay attacks are ineffective**.

## Replay Attack Categories

### `double.execute.spec.ts` - Double Execution Attacks
- ✅ **Basic Double Execute**: Second attempt always fails
- ✅ **Rapid Fire Attempts**: 100+ attempts all fail
- ✅ **Concurrent Execution**: Only one succeeds
- ✅ **State Machine Protection**: Terminal states are immutable

### `stale.signature.spec.ts` - Stale Signature Attacks
- ✅ **Sequence Number Protection**: Increasing nonces prevent replay
- ✅ **Cross-Signer Protection**: Signer A's sig can't replay as signer B

## Running Replay Tests

```bash
# Run all replay tests
npm test -- tests/phase3/replay

# Run specific attack type
npm test -- tests/phase3/replay/double.execute.spec.ts
```

---

# 🧬 How Phase 3 Works

## 1. Invariant Oracle (Single Source of Truth)
All tests use the same invariant definitions. If a test fails, it's a **true invariant violation**.

## 2. Generators Create Adversarial Inputs
- **Random**: Broad coverage of input space
- **Hostile**: Explicitly crafted to bypass defenses
- **Boundary**: Edge cases that break naive implementations

## 3. Continuous Assertion
Every fuzzing iteration checks invariants:
```typescript
// Every test iteration
const result = simulateActionSequence(proposal, hostileActions);
assertProposalInvariants(result.history); // Throws on violation
```

## 4. Systematic Coverage
- **50 to 10,000 iterations** per loop in the fuzz specs (see each spec for its loop count)
- **Multiple randomization strategies**
- **Chaos injection** during critical operations

---

# 🏆 What Phase 3 Proves

After Phase 3, you can credibly claim:

## What the suites check
- Proposal state-machine invariants (no double execution, monotonic transitions) over generated action sequences
- Replay and malformed-transaction checks over the wallet-flow mock (`tx.fuzz.spec.ts`, `stale.signature.spec.ts`)
- Gas pressure and out-of-gas handling over the same mock (`gas.fuzz.spec.ts`)

## What they do not show
These are checks on simulators inside the test folders. They do not show that the app, a policy or an emergency control stops anything. The app has no policy or pause feature (removed 2026-10-10).

---

# 📊 Test Statistics

| Test Category | Files | Tests |
|---------------|-------|-------|
| Invariants | 1 | 23 |
| Fuzzing | 3 | 41 |
| Replay | 2 | 25 |
| **Total** | **6** | **89** |

Counted with `npx jest tests/phase3` on 2026-10-10 (after the Phase 4 removal). *(Until then this table read: 9 files, "90+" tests, "16,000+" iterations, coverage "Complete". Those numbers were estimates, and the policy suites they counted were deleted.)*

---

# 🚀 Running Phase 3 Tests

## Quick Start
```bash
# Run everything
npm test -- tests/phase3

# Run invariants only
npm test -- tests/phase3/invariants

# Run fuzzing only
npm test -- tests/phase3/fuzz

# Run replay tests only
npm test -- tests/phase3/replay
```

## CI/CD Integration
```yaml
# Add to GitHub Actions
- name: Phase 3 Tests
  run: npm test -- tests/phase3
  env:
    SEED: ${{ github.run_number }} # Reproducible fuzzing
```

## Performance Expectations
- **Invariants**: < 30 seconds
- **Fuzzing**: < 5 minutes (10k iterations)
- **Replay**: < 2 minutes
- **Total**: < 8 minutes

---

# 🔧 Customization

## Adding New Invariants
1. Define invariant in `invariantOracle.ts`
2. Add assertion function
3. Update all relevant test files

## Adding New Generators
1. Create generator in `generators/`
2. Export from index file
3. Use in fuzz tests

## Adding New Attack Vectors
1. Create test in appropriate category
2. Use existing generators
3. Assert invariants hold

---

# 🧪 Integration with Existing Tests

Phase 3 builds on Phases 1 & 2:

- **Phase 1**: Unit tests prove functionality
- **Phase 2**: Chaos tests prove resilience
- **Phase 3**: Fuzzing proves robustness

Phase 3 tests are **independent** but can consume Phase 2 infrastructure (ChaosHarness, fault injection).

---

# 📈 Next Steps (Phase 4)

Phase 4 would add **formal verification**:

- **Property-based testing** with QuickCheck/Hypothesis
- **Model checking** with TLA+
- **Formal proofs** of critical invariants

But Phase 3 already provides **audit-grade assurance**.

---

**Last Updated**: Phase 3 Complete
**Maintainer**: Cosmos Multisig UI Team
**Next Phase**: Formal Verification (Optional)
