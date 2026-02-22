# Phase 4 Formal Model (TLA+)

## Requirements
- TLA+ Toolbox (recommended), OR
- TLC CLI (tlc2)
- Java JDK (for TLC)

## Run in Toolbox
1) Open TLA+ Toolbox
2) File → Open Spec → select `MultisigPhase4.tla`
3) Create a new model using `MultisigPhase4.cfg`
4) Run TLC

## Run via CLI
From repo root:
```bash
# Using TLA+ Toolbox's bundled TLC
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"
java -XX:+UseParallelGC -cp "/Applications/TLA+ Toolbox.app/Contents/Eclipse/tla2tools.jar" \
  tlc2.TLC -config formal/MultisigPhase4.cfg formal/MultisigPhase4.tla
```

## What is being proven (Safety Invariants)

TLC exhaustively checks that these invariants hold for ALL reachable states:

### Core Invariants (Checked)

| Invariant | Description |
|-----------|-------------|
| `Inv_NoDoubleExecute` | No proposal can be executed more than once |
| `Inv_ExecutedImpliesExactlyOne` | Executed status implies exactly one execution occurred |
| `Inv_TimelockRespected` | Executed proposals must have expired timelocks |
| `Inv_SpendLimitRespected` | Proposals exceeding spend limit cannot be executed |
| `Inv_ApprovedRequiresQuorum` | Approved status requires meeting quorum threshold |
| `Inv_ExecutedRequiresQuorum` | Executed status requires meeting quorum threshold |

### Precondition-Based Properties (Enforced at Execution Time)

The following properties are enforced by the `ExecutionAllowed(p)` precondition, NOT as global state invariants. This is because these conditions can change AFTER execution occurs:

- **Emergency Pause**: Execution is blocked when `emergencyPaused = TRUE`
- **Safe Mode**: Execution is blocked when `safeMode = TRUE`  
- **Policy Version Match**: Execution is blocked when `policyVersion ≠ ExpectedPolicyVersion`
- **Credential Validity**: At least one approving voter must have valid credentials

These are NOT checked as state invariants because the conditions can toggle ON/OFF after a valid execution has already occurred. The model proves that the preconditions correctly block execution when these conditions are active.

## Model Configuration

The default configuration in `MultisigPhase4.cfg`:
- 1 proposer, 3 voters
- 2 proposals (a, b)
- Quorum threshold: 2
- Spend limit: 100
- Expected policy version: 1

## State Space

With the default configuration, TLC explores millions of states to verify safety. The model includes adversarial scenarios:
- Credential revocation mid-vote
- Emergency/safe mode toggling during timelock
- Policy version bumps during execution window
- Batch execution attempts
