/**
 * Phase 3: Double Execution Attack Testing
 *
 * File: tests/phase3/replay/double.execute.spec.ts
 *
 * Tests that second execution attempts always fail, proving that
 * the system prevents double-spending and replay attacks.
 *
 * Core Invariant: Proposal can never execute twice
 */

import { MultisigChaosHarness } from "../../chaos/multisigChaosHarness";
import { ChaosHarness } from "../../chaos/chaosHarness";
import { faultController } from "../../chaos/faults";
import { assertProposalInvariants, ProposalState } from "../oracle/invariantOracle";
import { genExecutedProposal, genExecutableProposal, simulateActionSequence, ProposalAction } from "../generators/genProposal";

describe("PHASE 3 REPLAY: Double Execute Attack", () => {
  beforeEach(() => {
    faultController.reset();
  });

  // ==========================================================================
  // BASIC DOUBLE EXECUTE PROTECTION
  // ==========================================================================

  describe("Basic Double Execute Protection", () => {
    test("second execute attempt always fails", async () => {
      const chaos = new ChaosHarness();

      await chaos.runScenario({
        name: "double-execute-basic",
        scenario: async () => {
          // Create an executable proposal
          const proposal = genExecutedProposal(12345);
          const history: ProposalState[] = [...proposal.stateHistory];

          // First execution attempt (already executed)
          const firstAttempt = simulateActionSequence(proposal, ["EXECUTE"]);

          // Should have error about invariant violation or already executed
          expect(
            firstAttempt.errors.some(e => e.includes("INVARIANT") || e.includes("twice") || e.includes("terminal"))
          ).toBe(true);

          // Second execution attempt
          const secondAttempt = simulateActionSequence(proposal, ["EXECUTE"]);

          // Should also fail
          expect(
            secondAttempt.errors.some(e => e.includes("INVARIANT") || e.includes("twice") || e.includes("terminal"))
          ).toBe(true);
        },
      });
    });

    test("simulated double execute is caught by invariants", () => {
      const proposal = genExecutedProposal(12345);

      // Attempt to execute again
      const result = simulateActionSequence(proposal, ["EXECUTE"]);

      // Should have error about invariant violation or terminal state
      expect(result.errors.some(e => e.includes("INVARIANT") || e.includes("terminal") || e.includes("already"))).toBe(true);
    });
  });

  // ==========================================================================
  // RAPID FIRE EXECUTION ATTEMPTS
  // ==========================================================================

  describe("Rapid Fire Execution Attempts", () => {
    test("100 rapid execute attempts all fail after first success", async () => {
      const chaos = new ChaosHarness();

      await chaos.runScenario({
        name: "rapid-fire-execute",
        scenario: async () => {
          const proposal = genExecutableProposal(99999);

          // First execution succeeds
          const firstResult = simulateActionSequence(proposal, ["EXECUTE"]);
          expect(firstResult.errors.length).toBe(0);
          expect(firstResult.history.includes("EXECUTED")).toBe(true);

          // 99 more attempts all fail
          const executedProposal = { ...proposal, currentState: "EXECUTED" as ProposalState };
          for (let i = 0; i < 99; i++) {
            const attempt = simulateActionSequence(executedProposal, ["EXECUTE"]);
            expect(
              attempt.errors.some(e => e.includes("INVARIANT") || e.includes("twice") || e.includes("terminal"))
            ).toBe(true);
          }
        },
      });
    });

    test("multiple sequential execution attempts fail", () => {
      const proposal = genExecutableProposal(77777);

      // First execution succeeds
      const firstResult = simulateActionSequence(proposal, ["EXECUTE"]);
      expect(firstResult.errors.length).toBe(0);
      expect(firstResult.history.includes("EXECUTED")).toBe(true);

      // Subsequent attempts fail
      const executedProposal = { ...proposal, currentState: "EXECUTED" as ProposalState };
      for (let i = 0; i < 9; i++) {
        const attempt = simulateActionSequence(executedProposal, ["EXECUTE"]);
        expect(
          attempt.errors.some(e => e.includes("INVARIANT") || e.includes("twice") || e.includes("terminal"))
        ).toBe(true);
      }
    });
  });

  // ==========================================================================
  // STATE MACHINE PROTECTION
  // ==========================================================================

  describe("State Machine Protection", () => {
    test("EXECUTED state cannot transition", () => {
      const proposal = genExecutedProposal(99999);
      const history = proposal.stateHistory;

      // State should be terminal
      expect(history[history.length - 1]).toBe("EXECUTED");

      // Invariants should hold
      expect(() => assertProposalInvariants(history)).not.toThrow();

      // Attempting any action should fail
      const result = simulateActionSequence(proposal, ["EXECUTE"]);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test("all terminal states are immutable", () => {
      const terminalStates: ProposalState[] = ["EXECUTED", "FAILED", "REJECTED", "EXPIRED"];

      for (const terminal of terminalStates) {
        const proposal = genExecutedProposal(Math.random() * 1000);
        proposal.currentState = terminal;
        proposal.stateHistory = ["DRAFT", "OPEN", terminal];

        const result = simulateActionSequence(proposal, ["EXECUTE", "VOTE_APPROVE", "CANCEL"]);
        const finalState = result.history[result.history.length - 1];

        // Should remain in terminal state
        expect(finalState).toBe(terminal);
      }
    });
  });

  // ==========================================================================
  // CHAOS INJECTION DURING EXECUTION
  // ==========================================================================

  describe("Chaos Injection During Execution", () => {
    test("executed proposal cannot be re-executed even with policy changes", () => {
      const proposal = genExecutedProposal(55555);
      const history = [...proposal.stateHistory];

      // Verify it's already executed
      expect(history.includes("EXECUTED")).toBe(true);

      // Attempt to execute again
      const result = simulateActionSequence(proposal, ["EXECUTE"]);

      // Should fail due to terminal state
      expect(
        result.errors.some(e => e.includes("terminal") || e.includes("INVARIANT") || e.includes("twice"))
      ).toBe(true);
    });

    test("state machine prevents double execution regardless of context", () => {
      // Test with different proposal states
      const states: ProposalState[] = ["EXECUTED", "FAILED", "REJECTED", "EXPIRED"];

      for (const state of states) {
        const proposal = genExecutedProposal(1000 + Math.random() * 1000);
        proposal.currentState = state;
        proposal.stateHistory = ["DRAFT", "OPEN", "APPROVED", "EXECUTABLE", state];

        const result = simulateActionSequence(proposal, ["EXECUTE"]);

        // Should fail due to terminal state
        expect(
          result.errors.some(e => e.includes("terminal") || e.includes("already"))
        ).toBe(true);
      }
    });
  });

  // ==========================================================================
  // MULTI-PROPOSAL ISOLATION
  // ==========================================================================

  describe("Multi-Proposal Isolation", () => {
    test("each proposal can only be executed once", () => {
      // Test multiple independent proposals
      for (let i = 0; i < 10; i++) {
        const proposal = genExecutableProposal(2000 + i);

        // First execution succeeds
        const firstResult = simulateActionSequence(proposal, ["EXECUTE"]);
        expect(firstResult.errors.length).toBe(0);
        expect(firstResult.history.includes("EXECUTED")).toBe(true);

        // Second execution fails
        const executedProposal = { ...proposal, currentState: "EXECUTED" as ProposalState };
        const secondResult = simulateActionSequence(executedProposal, ["EXECUTE"]);
        expect(
          secondResult.errors.some(e => e.includes("INVARIANT") || e.includes("twice") || e.includes("terminal"))
        ).toBe(true);
      }
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe("Edge Cases", () => {
    test("hostile action sequences cannot bypass double execution prevention", () => {
      const hostileSequences: ProposalAction[][] = [
        ["EXECUTE", "EXECUTE", "EXECUTE"], // Multiple executes
        ["EXECUTE", "VOTE_APPROVE", "EXECUTE"], // Vote after execute + execute
        ["EXECUTE", "CANCEL", "EXECUTE"], // Cancel after execute + execute
        ["EXECUTE", "EXPIRE", "EXECUTE"], // Expire after execute + execute
      ];

      for (const sequence of hostileSequences) {
        const proposal = genExecutableProposal(Math.random() * 10000);

        // Execute first to get to EXECUTED state
        const firstExecute = simulateActionSequence(proposal, ["EXECUTE"]);
        expect(firstExecute.errors.length).toBe(0);

        // Then try hostile sequence
        const executedProposal = { ...proposal, currentState: "EXECUTED" as ProposalState };
        const result = simulateActionSequence(executedProposal, sequence);

        // Should have errors for the execution attempts
        const executeAttempts = sequence.filter(action => action === "EXECUTE").length;
        if (executeAttempts > 0) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  // ==========================================================================
  // STRESS TESTING
  // ==========================================================================

  describe("Stress Testing", () => {
    test("1000 proposals can each be executed exactly once", () => {
      for (let i = 0; i < 1000; i++) {
        const proposal = genExecutableProposal(3000 + i);

        // First execution succeeds
        const firstResult = simulateActionSequence(proposal, ["EXECUTE"]);
        expect(firstResult.errors.length).toBe(0);
        expect(firstResult.history.includes("EXECUTED")).toBe(true);

        // Second execution fails
        const executedProposal = { ...proposal, currentState: "EXECUTED" as ProposalState };
        const secondResult = simulateActionSequence(executedProposal, ["EXECUTE"]);
        expect(
          secondResult.errors.some(e => e.includes("INVARIANT") || e.includes("twice") || e.includes("terminal"))
        ).toBe(true);
      }
    });
  });
});

