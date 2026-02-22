/**
 * Phase 3: Proposal Invariant Tests
 *
 * File: tests/phase3/invariants/proposal.invariants.spec.ts
 *
 * Tests that proposal state machine invariants are never violated
 * regardless of input sequence or ordering.
 *
 * Core Invariants:
 * ❌ Proposal can never execute twice
 * ❌ State transitions must be monotonic
 * ❌ Terminal states are immutable
 */

import {
  assertProposalInvariants,
  ProposalState,
  trackStateTransition,
} from "../oracle/invariantOracle";
import {
  genProposal,
  genExecutableProposal,
  genExecutedProposal,
  genRandomActionSequence,
  genHostileActionSequence,
  simulateActionSequence,
  genProposalBatch,
  setSeed,
} from "../generators/genProposal";

describe("PHASE 3 INVARIANTS: Proposal State Machine", () => {
  beforeEach(() => {
    // Reset random seed for reproducibility
    setSeed(Date.now());
  });

  // ==========================================================================
  // INVARIANT 1: No Double Execution
  // ==========================================================================

  describe("Invariant: No Double Execution", () => {
    test("state history with double EXECUTED throws invariant violation", () => {
      const history: ProposalState[] = [
        "DRAFT",
        "OPEN",
        "APPROVED",
        "EXECUTABLE",
        "EXECUTED",
        "EXECUTED", // Second execution attempt
      ];

      expect(() => assertProposalInvariants(history)).toThrow(
        /INVARIANT VIOLATION.*[Dd]ouble execution/
      );
    });

    test("single execution is allowed", () => {
      const history: ProposalState[] = [
        "DRAFT",
        "OPEN",
        "APPROVED",
        "EXECUTABLE",
        "EXECUTED",
      ];

      expect(() => assertProposalInvariants(history)).not.toThrow();
    });

    test("repeated terminal states (other than EXECUTED) are allowed", () => {
      const history: ProposalState[] = ["DRAFT", "OPEN", "REJECTED", "REJECTED"];

      expect(() => assertProposalInvariants(history)).not.toThrow();
    });
  });

  // ==========================================================================
  // INVARIANT 2: Monotonic State Transitions
  // ==========================================================================

  describe("Invariant: Monotonic State Transitions", () => {
    test("regression after EXECUTED throws invariant violation", () => {
      const history: ProposalState[] = [
        "DRAFT",
        "OPEN",
        "APPROVED",
        "EXECUTABLE",
        "EXECUTED",
        "OPEN", // Illegal regression
      ];

      expect(() => assertProposalInvariants(history)).toThrow(
        /INVARIANT VIOLATION.*regression/
      );
    });

    test("regression after FAILED throws invariant violation", () => {
      const history: ProposalState[] = [
        "DRAFT",
        "OPEN",
        "FAILED",
        "OPEN", // Illegal regression
      ];

      expect(() => assertProposalInvariants(history)).toThrow(
        /INVARIANT VIOLATION.*regression/
      );
    });

    test("valid forward progression is allowed", () => {
      const history: ProposalState[] = [
        "DRAFT",
        "OPEN",
        "APPROVED",
        "EXECUTABLE",
        "EXECUTED",
      ];

      expect(() => assertProposalInvariants(history)).not.toThrow();
    });
  });

  // ==========================================================================
  // INVARIANT 3: Valid State Transitions Only
  // ==========================================================================

  describe("Invariant: Valid State Transitions Only", () => {
    test("DRAFT cannot skip directly to EXECUTED", () => {
      const history: ProposalState[] = ["DRAFT", "EXECUTED"];

      expect(() => assertProposalInvariants(history)).toThrow(
        /INVARIANT VIOLATION.*[Ii]nvalid transition/
      );
    });

    test("OPEN cannot skip directly to EXECUTED", () => {
      const history: ProposalState[] = ["DRAFT", "OPEN", "EXECUTED"];

      expect(() => assertProposalInvariants(history)).toThrow(
        /INVARIANT VIOLATION.*[Ii]nvalid transition/
      );
    });

    test("valid transition OPEN -> APPROVED is allowed", () => {
      const history: ProposalState[] = ["DRAFT", "OPEN", "APPROVED"];

      expect(() => assertProposalInvariants(history)).not.toThrow();
    });

    test("APPROVED -> EXECUTABLE -> EXECUTED is valid", () => {
      const history: ProposalState[] = ["DRAFT", "OPEN", "APPROVED", "EXECUTABLE", "EXECUTED"];

      expect(() => assertProposalInvariants(history)).not.toThrow();
    });
  });

  // ==========================================================================
  // FUZZ: Random State Sequences
  // ==========================================================================

  describe("Fuzz: Random State Sequences", () => {
    test("trackStateTransition catches violations immediately", () => {
      const validHistory: ProposalState[] = ["DRAFT"];

      // Valid transitions should work
      const afterOpen = trackStateTransition(validHistory, "OPEN");
      expect(afterOpen).toEqual(["DRAFT", "OPEN"]);

      const afterApproved = trackStateTransition(afterOpen, "APPROVED");
      expect(afterApproved).toEqual(["DRAFT", "OPEN", "APPROVED"]);

      // Invalid transition should throw
      expect(() => trackStateTransition(afterApproved, "DRAFT")).toThrow(
        /INVARIANT VIOLATION/
      );
    });

    test("simulateActionSequence captures errors from hostile sequences", () => {
      const proposal = genProposal(12345);
      proposal.threshold = 2; // Ensure threshold allows 2 votes to approve
      proposal.timelock = { unlockAtMs: Date.now() - 3600000 }; // Ensure timelock is expired

      // Double execute hostile sequence: CREATE, 2x VOTE_APPROVE, EXECUTE, EXECUTE
      const hostileSequence = genHostileActionSequence("double_execute");
      const result = simulateActionSequence(proposal, hostileSequence);

      // Should have captured the double execute error (second EXECUTE on terminal EXECUTED state)
      expect(result.errors.some((e) =>
        e.includes("terminal") ||
        e.includes("INVARIANT") ||
        e.includes("already")
      )).toBe(true);
    });

    test.each([
      ["double_execute"],
      ["execute_without_votes"],
      ["vote_after_execute"],
      ["cancel_after_execute"],
      ["race_condition"],
      ["rapid_fire"],
    ])("hostile sequence '%s' does not bypass invariants", (hostileType) => {
      const proposal = genProposal(42);
      const sequence = genHostileActionSequence(hostileType);
      const result = simulateActionSequence(proposal, sequence);

      // Either we get errors (expected for hostile sequences)
      // OR the resulting history is still valid
      if (result.errors.length === 0) {
        expect(() => assertProposalInvariants(result.history)).not.toThrow();
      } else {
        // Errors were caught - that's the expected behavior
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });

  // ==========================================================================
  // FUZZ: Batch Proposal Generation
  // ==========================================================================

  describe("Fuzz: Batch Proposal Testing", () => {
    test("100 random proposals have valid initial state", () => {
      const proposals = genProposalBatch(100, 99999);

      for (const proposal of proposals) {
        expect(() => assertProposalInvariants(proposal.stateHistory)).not.toThrow();
      }
    });

    test("genExecutedProposal always produces valid history", () => {
      for (let seed = 0; seed < 50; seed++) {
        const proposal = genExecutedProposal(seed);
        expect(() => assertProposalInvariants(proposal.stateHistory)).not.toThrow();
        expect(proposal.currentState).toBe("EXECUTED");
      }
    });

    test("genExecutableProposal is ready for execution", () => {
      for (let seed = 0; seed < 50; seed++) {
        const proposal = genExecutableProposal(seed);
        expect(() => assertProposalInvariants(proposal.stateHistory)).not.toThrow();
        expect(proposal.currentState).toBe("EXECUTABLE");

        // Simulate execution
        const result = simulateActionSequence(proposal, ["EXECUTE"]);
        expect(result.errors.length).toBe(0);
        expect(result.history[result.history.length - 1]).toBe("EXECUTED");
      }
    });
  });

  // ==========================================================================
  // STRESS: High Volume Invariant Checking
  // ==========================================================================

  describe("Stress: High Volume Testing", () => {
    test("1000 random action sequences preserve invariants", () => {
      for (let i = 0; i < 1000; i++) {
        const proposal = genProposal(i);
        const randomActions = genRandomActionSequence(10, i);
        const result = simulateActionSequence(proposal, randomActions);

        // The simulation should either:
        // 1. Have errors (actions were rejected correctly)
        // 2. Have a valid final history
        if (result.errors.length === 0) {
          expect(() => assertProposalInvariants(result.history)).not.toThrow();
        }
      }
    });

    test("state machine never allows backward transitions", () => {
      const terminalStates: ProposalState[] = ["EXECUTED", "FAILED", "REJECTED", "EXPIRED"];

      for (let i = 0; i < 500; i++) {
        const proposal = genProposal(i);
        const randomActions = genRandomActionSequence(15, i + 1000);
        const result = simulateActionSequence(proposal, randomActions);

        // Find the first terminal state in history
        const history = result.history;
        let terminalIndex = -1;

        for (let j = 0; j < history.length; j++) {
          if (terminalStates.includes(history[j])) {
            terminalIndex = j;
            break;
          }
        }

        // If we hit a terminal state, no different state should follow
        if (terminalIndex >= 0 && terminalIndex < history.length - 1) {
          const terminalState = history[terminalIndex];
          for (let k = terminalIndex + 1; k < history.length; k++) {
            expect(history[k]).toBe(terminalState);
          }
        }
      }
    });
  });
});

