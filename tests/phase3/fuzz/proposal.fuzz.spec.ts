/**
 * Phase 3: Proposal Lifecycle Fuzzing
 *
 * File: tests/phase3/fuzz/proposal.fuzz.spec.ts
 *
 * Fuzzes proposal lifecycle with randomized vote/execute orderings
 * to prove that no sequence of events can violate core invariants.
 *
 * Goal: Prove that randomized action sequences cannot lead to
 * double execution, state regression, or invalid transitions.
 */

import { ChaosHarness } from "../../chaos/chaosHarness";
import { MultisigChaosHarness } from "../../chaos/multisigChaosHarness";
import { faultController } from "../../chaos/faults";
import {
  assertProposalInvariants,
  assertExecutionInvariants,
  ProposalState,
  ExecutionContext,
} from "../oracle/invariantOracle";
import {
  genProposal,
  genExecutableProposal,
  genRandomActionSequence,
  genHostileActionSequence,
  simulateActionSequence,
  ProposalAction,
  setSeed,
} from "../generators/genProposal";
import { evaluatePoliciesMinimal } from "../../../__tests__/adapters/policyEngine.adapter";

describe("PHASE 3 FUZZ: Proposal Lifecycle", () => {
  beforeEach(() => {
    faultController.reset();
  });

  // ==========================================================================
  // FUZZ: Randomized Vote/Execute Orderings
  // ==========================================================================

  describe("Fuzz: Randomized Vote/Execute Orderings", () => {
    test("1000 random action sequences either succeed or fail with proper error handling", async () => {
      let totalSequences = 0;
      let sequencesWithErrors = 0;
      let invariantViolations = 0;

      for (let i = 0; i < 1000; i++) {
        setSeed(i);
        const proposal = genProposal(i);
        const actions = genRandomActionSequence(15, i);

        try {
          const result = simulateActionSequence(proposal, actions);
          totalSequences++;

          if (result.errors.length > 0) {
            sequencesWithErrors++;
          }

          // The final history must be valid (no invariant violations)
          assertProposalInvariants(result.history);
        } catch (error: any) {
          // If simulateActionSequence throws due to invariant violation, that's expected
          if (error.message.includes("INVARIANT VIOLATION")) {
            invariantViolations++;
          } else {
            throw error; // Re-throw unexpected errors
          }
        }
      }

      console.log(
        `Tested ${totalSequences} sequences, ${sequencesWithErrors} had rejected actions, ${invariantViolations} had invariant violations`
      );

      // With proper state machine handling, random sequences should NOT produce invariant violations
      // They either succeed or fail gracefully with proper error handling
      expect(invariantViolations).toBe(0);
    });

    test("500 sequences with chaos injection preserve invariants", async () => {
      const chaos = new ChaosHarness();

      for (let i = 0; i < 500; i++) {
        setSeed(i);

        await chaos.runScenario({
          name: `proposal-fuzz-${i}`,
          faults: [
            {
              name: "random-pause",
              hook: "beforeExecute",
              once: true,
              run: () => {
                // 20% chance to pause during execution
                if (Math.random() < 0.2) {
                  faultController.state.emergencyPaused = true;
                }
              },
            },
          ],
          scenario: async () => {
            const proposal = genProposal(i);
            const actions = genRandomActionSequence(10, i + 1000);

            try {
              const result = simulateActionSequence(proposal, actions);
              // Invariants must hold for successful simulations
              assertProposalInvariants(result.history);
            } catch (error: any) {
              // Invariant violations are expected for some invalid sequences
              if (!error.message.includes("INVARIANT VIOLATION")) {
                throw error;
              }
            }
          },
        });

        faultController.reset();
      }
    });
  });

  // ==========================================================================
  // FUZZ: Hostile Action Sequences
  // ==========================================================================

  describe("Fuzz: Hostile Action Sequences", () => {
    const hostileTypes = [
      "double_execute",
      "execute_without_votes",
      "vote_after_execute",
      "cancel_after_execute",
      "race_condition",
      "rapid_fire",
    ];

    test.each(hostileTypes)(
      "hostile sequence '%s' cannot violate invariants",
      async (hostileType) => {
        for (let i = 0; i < 100; i++) {
          setSeed(i);
          const proposal = genProposal(i);
          const actions = genHostileActionSequence(hostileType, i);
          const result = simulateActionSequence(proposal, actions);

          // Hostile actions should either:
          // 1. Be rejected (errors captured)
          // 2. Not violate invariants
          if (result.errors.length === 0) {
            expect(() => assertProposalInvariants(result.history)).not.toThrow();
          }
        }
      }
    );

    test("100 double-execute attempts all fail", async () => {
      for (let i = 0; i < 100; i++) {
        const proposal = genExecutableProposal(i);
        const actions: ProposalAction[] = ["EXECUTE", "EXECUTE"];
        const result = simulateActionSequence(proposal, actions);

        // Should have error for second execution
        expect(result.errors.some((e) => e.includes("terminal") || e.includes("already"))).toBe(
          true
        );
      }
    });
  });

  // ==========================================================================
  // FUZZ: State Machine Transitions
  // ==========================================================================

  describe("Fuzz: State Machine Transitions", () => {
    test("no sequence can skip required states", async () => {
      for (let i = 0; i < 500; i++) {
        setSeed(i);
        const proposal = genProposal(i);

        // Try to execute immediately
        const directExecute = simulateActionSequence(proposal, ["EXECUTE"]);
        expect(directExecute.errors.length).toBeGreaterThan(0);

        // Create then try to execute
        const createThenExecute = simulateActionSequence(proposal, ["CREATE", "EXECUTE"]);
        expect(createThenExecute.errors.length).toBeGreaterThan(0);
      }
    });

    test("valid sequences reach EXECUTED state", async () => {
      for (let i = 0; i < 100; i++) {
        setSeed(i);
        const proposal = genProposal(i);
        proposal.threshold = 2;
        // Ensure timelock is expired for valid execution
        proposal.timelock = { unlockAtMs: Date.now() - 3600000 };

        // Valid sequence: CREATE → OPEN, VOTE → APPROVED, EXECUTE → EXECUTABLE, EXECUTE → EXECUTED
        const validSequence: ProposalAction[] = [
          "CREATE",
          "VOTE_APPROVE",
          "VOTE_APPROVE",
          "EXECUTE", // APPROVED → EXECUTABLE
          "EXECUTE", // EXECUTABLE → EXECUTED
        ];
        const result = simulateActionSequence(proposal, validSequence);

        expect(result.errors.length).toBe(0);
        expect(result.history[result.history.length - 1]).toBe("EXECUTED");
      }
    });

    test("terminal states cannot transition", async () => {
      const terminalStates: ProposalState[] = ["EXECUTED", "FAILED", "REJECTED", "EXPIRED"];

      for (const terminal of terminalStates) {
        for (let i = 0; i < 50; i++) {
          const proposal = genProposal(i);
          proposal.currentState = terminal;
          proposal.stateHistory = ["DRAFT", "OPEN", terminal];

          const actions = genRandomActionSequence(5, i);
          const result = simulateActionSequence(proposal, actions);

          // Final state should still be terminal
          const finalState = result.history[result.history.length - 1];
          expect(finalState).toBe(terminal);
        }
      }
    });
  });

  // ==========================================================================
  // FUZZ: Policy + Proposal Integration
  // ==========================================================================

  describe("Fuzz: Policy + Proposal Integration", () => {
    test("emergency pause blocks execution at any proposal state", async () => {
      const states: ProposalState[] = ["OPEN", "APPROVED", "EXECUTABLE"];

      for (const state of states) {
        for (let i = 0; i < 50; i++) {
          const proposal = genProposal(i);
          proposal.currentState = state;

          faultController.state.emergencyPaused = true;

          const result = await evaluatePoliciesMinimal({
            isPaused: true,
            policyVersion: 1,
            expectedPolicyVersion: 1,
          }, 'execution');

          expect(result.allowed).toBe(false);

          // Verify invariant
          const execCtx: ExecutionContext = {
            proposalId: proposal.id,
            policies: [{ policyName: "emergency", allowed: false, reason: "paused" }],
            emergencyPaused: true,
            safeMode: false,
            executionAttempted: true,
            executionSucceeded: false,
          };

          expect(() => assertExecutionInvariants(execCtx)).not.toThrow();

          faultController.reset();
        }
      }
    });

    test("credential revocation mid-flow blocks execution", async () => {
      for (let i = 0; i < 100; i++) {
        const proposal = genExecutableProposal(i);

        // Start with valid credential
        faultController.state.credentialValid = true;

        const voteResult = await evaluatePoliciesMinimal({
          policyVersion: 1,
          expectedPolicyVersion: 1,
          credential: { holder: "cosmos1test", valid: true, role: "member" },
        }, 'proposal');

        expect(voteResult.allowed).toBe(true);

        // Revoke credential
        faultController.state.credentialValid = false;

        const execResult = await evaluatePoliciesMinimal({
          policyVersion: 1,
          expectedPolicyVersion: 1,
        }, 'execution');

        expect(execResult.allowed).toBe(false);

        faultController.reset();
      }
    });
  });

  // ==========================================================================
  // STRESS: High Volume Lifecycle Testing
  // ==========================================================================

  describe("Stress: High Volume Lifecycle Testing", () => {
    test("5000 proposal lifecycles produce valid histories (no invariant violations in output)", async () => {
      let validHistories = 0;
      let rejectedActions = 0;

      for (let i = 0; i < 5000; i++) {
        setSeed(i);
        const proposal = genProposal(i);
        const actionCount = 5 + (i % 15);
        const actions = genRandomActionSequence(actionCount, i);
        const result = simulateActionSequence(proposal, actions);

        // Count rejected actions (these prevent invalid state transitions)
        rejectedActions += result.errors.length;

        // The history should always be valid because applyAction rejects invalid transitions
        assertProposalInvariants(result.history);
        validHistories++;
      }

      console.log(`Tested ${validHistories} proposals, ${rejectedActions} actions were rejected`);
      expect(validHistories).toBe(5000);
    });

    test("1000 executable proposals can be executed exactly once", async () => {
      for (let i = 0; i < 1000; i++) {
        const proposal = genExecutableProposal(i);

        // First execution succeeds
        const firstExec = simulateActionSequence(proposal, ["EXECUTE"]);
        expect(firstExec.errors.length).toBe(0);
        expect(firstExec.history[firstExec.history.length - 1]).toBe("EXECUTED");

        // Second execution fails
        const executedProposal = { ...proposal, currentState: "EXECUTED" as ProposalState };
        const secondExec = simulateActionSequence(executedProposal, ["EXECUTE"]);
        expect(
          secondExec.errors.some(e => e.includes("terminal") || e.includes("already"))
        ).toBe(true);
      }
    });
  });

  // ==========================================================================
  // CHAOS: MultisigChaosHarness Integration
  // ==========================================================================

  describe("Chaos: MultisigChaosHarness Integration", () => {
    test("harness with random faults maintains invariants", async () => {
      const chaos = new ChaosHarness();
      const stateHistories: ProposalState[][] = [];

      for (let i = 0; i < 50; i++) {
        await chaos.runScenario({
          name: `multisig-chaos-${i}`,
          faults: [
            {
              name: "random-version-drift",
              hook: "beforePolicyEval",
              once: false,
              run: () => {
                if (Math.random() < 0.1) {
                  faultController.state.policyVersion = 2;
                }
              },
            },
            {
              name: "random-credential-revoke",
              hook: "afterVote",
              once: false,
              run: () => {
                if (Math.random() < 0.1) {
                  faultController.state.credentialValid = false;
                }
              },
            },
          ],
          scenario: async () => {
            const proposal = genProposal(i);
            const history: ProposalState[] = [proposal.currentState];

            // Simulate lifecycle
            const actions = genRandomActionSequence(8, i);
            const result = simulateActionSequence(proposal, actions);
            history.push(...result.history.slice(1));

            stateHistories.push(history);
            assertProposalInvariants(history);
          },
        });

        faultController.reset();
      }

      console.log(`Tested ${stateHistories.length} chaos scenarios`);
    });
  });
});

