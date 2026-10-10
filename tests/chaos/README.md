# Phase 2B: End-to-End Chaos Testing Framework

> **Cluster:** tests · **Tags:** chaos, fault-injection, websocket, simulator, phase4-removed · **Related:** [Phase 3 tests](../phase3/README.md), [Formal model](../../formal/README.md), [PRD](../../docs/PRD.md)

**File**: `tests/chaos/README.md`

> **What a pass means (2026-10-10):** the one scenario left here (`websocket.partialFailure.reconcile.spec.ts`) drives fake functions defined inside the spec, not app code. A pass is not evidence that the app enforces anything. The five policy scenarios (credential revoked mid-vote, safe mode during timelock, batch spend limit, policy version mismatch, emergency pause during broadcast) ran a stand-in policy engine from the test folder, not `lib/policies`. They were deleted on 2026-10-10 together with Phase 4, which the app never used; the code is archived at git tag `archive/phase4-policies-2026-10-10`.

This directory contains the fault-injection harness and the chaos scenarios that remain.

## Structure

```
tests/chaos/
├── faults.ts                    # Fault injection controller + hooks
├── chaosHarness.ts              # Deterministic test scheduler
├── installPatches.ts            # Runtime patch for MultiRpcVerifier.broadcastAndVerify
├── multisigChaosHarness.ts      # End-to-end multisig lifecycle harness
├── scenarios/                   # Chaos test scenarios
│   └── websocket.partialFailure.reconcile.spec.ts
└── README.md                    # This file
```

## Phase 2A: Policy-Level Chaos (removed 2026-10-10)

The six policy-level scenarios (mid-vote credential revocation, safe mode during a timelock, batch spend limit, policy version drift, emergency pause during broadcast, WebSocket partial failures) tested a stand-in policy engine, not app code. Five were deleted with Phase 4; the WebSocket one stays and uses fakes defined in the spec.

## Phase 2B: End-to-End Chaos (Framework Ready)

The `MultisigChaosHarness` extends Phase 2A to test the **complete proposal lifecycle**:

```typescript
import { MultisigChaosHarness } from "../multisigChaosHarness";

const ms = new MultisigChaosHarness("contract");

// Initialize engine
ms.createContractEngine({
  chainId: "cosmoshub-4",
  multisigAddress: "cosmos1...",
  nodeAddress: "https://rpc.cosmos.network",
  // ... other config
});

// Lifecycle with chaos injection
const proposalId = await ms.submitProposal(...);
await ms.vote(...);           // beforeVote/afterVote hooks fire
await ms.executeProposal(...); // beforeExecute/duringBroadcast hooks fire
```

### Chaos Hooks Available

The harness fires these hooks at critical moments:

- **`beforeVote`**: Before proposal approval/voting
- **`afterVote`**: After vote recorded
- **`beforeExecute`**: Before proposal execution starts
- **`duringBroadcast`**: During transaction broadcast (via installPatches)
- **`afterBroadcast`**: After broadcast completes
- **`onReconcile`**: During state reconciliation

### Usage Pattern

```typescript
import { ChaosHarness } from "./chaosHarness";
import { faultController } from "./faults";

test("a fault fires during broadcast", async () => {
  const h = new ChaosHarness();

  await h.runScenario({
    name: "broadcast fails once",
    faults: [{
      name: "broadcast-fails",
      hook: "duringBroadcast",   // fired by the MultiRpcVerifier patch in installPatches.ts
      once: true,
      run: () => { throw new Error("RPC_DOWN"); }
    }],
    scenario: async () => {
      // Drive the code under test here; the hook fires inside
      // MultiRpcVerifier.broadcastAndVerify once installChaosPatches() has run.
    }
  });
});
```

## Requirements for E2E Tests

To run full E2E chaos tests, you need:

### 1. Blockchain Client Setup

```typescript
// Real blockchain
const client = await SigningCosmWasmClient.connectWithSigner(
  rpcEndpoint,
  offlineSigner
);

// OR local testnet
const client = await setupLocalTestnet();

// OR mocked client
const client = createMockSigningClient();
```

### 2. Proposal Lifecycle

The engine must have proposals created and stored:

```typescript
const proposal = await engine.createProposal(input);
await engine.approveProposal(proposal.id, voter1);
await engine.approveProposal(proposal.id, voter2);
// Now ready for executeProposal()
```

## Current Test Status

| Test Type | Status | Location |
|-----------|--------|----------|
| WebSocket drop + reconcile (fakes inside the spec) | passing | `scenarios/websocket.partialFailure.reconcile.spec.ts` |
| E2E chaos (framework) | ✅ **Ready** | `multisigChaosHarness.ts` |
| E2E chaos (full tests) | ⏭️ **Requires setup** | Future |

## Running Tests

```bash
# Run all chaos tests
npm test -- tests/chaos

# Run specific scenario
npm test -- tests/chaos/scenarios/websocket.partialFailure.reconcile.spec.ts

# Watch mode
npm test -- --watch tests/chaos
```

## What This Does And Does Not Show

- A fault controller and a scheduler can inject failures at named hooks, and `MultiRpcVerifier.broadcastAndVerify` fires `duringBroadcast` / `afterBroadcast` once patched.
- The WebSocket scenario shows a drop-then-reconcile flow on fakes defined in the spec.
- It does **not** show that the app stops a transaction because of a credential, a pause, a spend limit or a policy version. The app has none of those features (removed 2026-10-10).

## Next Steps (Phase 3+)

- **Integration tests**: Wire E2E harness to local testnet
- **Adversarial fuzzing**: Random fault injection sequences
- **Mutation testing**: Verify the test suite catches real bugs
- **Formal verification**: Property-based testing with invariants

## Architecture

The chaos framework uses **runtime patching** to inject faults without modifying production code:

```typescript
// installPatches.ts wraps MultiRpcVerifier.broadcastAndVerify
MultiRpcVerifier.broadcastAndVerify = async (...args: any[]) => {
  await faultController.fire("duringBroadcast", { args });
  const res = await original(...args);
  await faultController.fire("afterBroadcast", { res });
  return res;
};
```

This means:
- **Zero production code changes** required
- **Hot-swappable** test strategies
- **Deterministic** replay from fault logs

---

**Last Updated**: Phase 2B Framework Complete
**Maintainer**: Cosmos Multisig UI Team
**Next Phase**: Adversarial Fuzzing + Property Testing
