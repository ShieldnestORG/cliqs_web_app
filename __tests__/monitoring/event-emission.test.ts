/**
 * Event Emission Guarantee Tests
 * 
 * File: __tests__/monitoring/event-emission.test.ts
 * 
 * Tests for Phase 4 guaranteed event emission
 */

import {
  EventStream,
  MemorySink,
  MultisigEvent,
  MultisigEventType,
  createEventStream,
  createMemorySink,
} from "@/lib/monitoring/event-stream";

// ============================================================================
// Event Stream Tests
// ============================================================================

describe("EventStream", () => {
  let stream: EventStream;
  let memorySink: MemorySink;

  beforeEach(() => {
    stream = createEventStream();
    memorySink = createMemorySink("test-sink", "Test Memory Sink");
    stream.addSink(memorySink);
  });

  describe("emit", () => {
    it("emits events to all sinks", async () => {
      const eventId = await stream.emit({
        type: "PROPOSAL_CREATED",
        multisigAddress: "cosmos1test...",
        chainId: "cosmoshub-4",
        timestamp: Math.floor(Date.now() / 1000),
        data: { proposalId: "1" },
      });

      expect(eventId).toBeDefined();
      expect(eventId.startsWith("evt_")).toBe(true);

      const events = memorySink.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("PROPOSAL_CREATED");
    });

    it("generates unique event IDs", async () => {
      const id1 = await stream.emit({
        type: "PROPOSAL_CREATED",
        multisigAddress: "cosmos1test...",
        chainId: "cosmoshub-4",
        timestamp: Math.floor(Date.now() / 1000),
        data: {},
      });

      const id2 = await stream.emit({
        type: "PROPOSAL_CREATED",
        multisigAddress: "cosmos1test...",
        chainId: "cosmoshub-4",
        timestamp: Math.floor(Date.now() / 1000),
        data: {},
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe("guaranteed events", () => {
    it("emits PROPOSAL_QUEUED with required attributes", async () => {
      await stream.emitProposalEvent(
        "PROPOSAL_QUEUED",
        "cosmos1test...",
        "cosmoshub-4",
        "42",
        {
          queuedAt: Math.floor(Date.now() / 1000),
          executeAfter: Math.floor(Date.now() / 1000) + 3600,
        },
      );

      const events = memorySink.getEventsByType("PROPOSAL_QUEUED");
      expect(events).toHaveLength(1);
      expect(events[0].data.proposalId).toBe("42");
      expect(events[0].data.queuedAt).toBeDefined();
      expect(events[0].data.executeAfter).toBeDefined();
    });

    it("emits PROPOSAL_EXECUTED with required attributes", async () => {
      await stream.emitProposalEvent(
        "PROPOSAL_EXECUTED",
        "cosmos1test...",
        "cosmoshub-4",
        "42",
        {
          txHash: "ABC123",
          executor: "cosmos1executor...",
        },
      );

      const events = memorySink.getEventsByType("PROPOSAL_EXECUTED");
      expect(events).toHaveLength(1);
      expect(events[0].data.proposalId).toBe("42");
      expect(events[0].data.txHash).toBe("ABC123");
      expect(events[0].data.executor).toBe("cosmos1executor...");
    });

    it("emits PROPOSAL_FAILED with required attributes", async () => {
      await stream.emitProposalEvent(
        "PROPOSAL_FAILED",
        "cosmos1test...",
        "cosmoshub-4",
        "42",
        {
          errorCode: "INSUFFICIENT_FUNDS",
          errorMsg: "Not enough tokens",
        },
      );

      const events = memorySink.getEventsByType("PROPOSAL_FAILED");
      expect(events).toHaveLength(1);
      expect(events[0].data.errorCode).toBe("INSUFFICIENT_FUNDS");
      expect(events[0].data.errorMsg).toBe("Not enough tokens");
    });

    it("emits CREDENTIAL_MINTED with required attributes", async () => {
      await stream.emitCredentialEvent(
        "CREDENTIAL_MINTED",
        "cosmos1team...",
        "cosmoshub-4",
        "class-1",
        "token-1",
        {
          recipient: "cosmos1member...",
          role: "member",
        },
      );

      const events = memorySink.getEventsByType("CREDENTIAL_MINTED");
      expect(events).toHaveLength(1);
      expect(events[0].data.classId).toBe("class-1");
      expect(events[0].data.tokenId).toBe("token-1");
      expect(events[0].data.recipient).toBe("cosmos1member...");
      expect(events[0].data.role).toBe("member");
    });

    it("emits CREDENTIAL_BURNED with required attributes", async () => {
      await stream.emitCredentialEvent(
        "CREDENTIAL_BURNED",
        "cosmos1team...",
        "cosmoshub-4",
        "class-1",
        "token-1",
        {
          previousOwner: "cosmos1member...",
        },
      );

      const events = memorySink.getEventsByType("CREDENTIAL_BURNED");
      expect(events).toHaveLength(1);
      expect(events[0].data.classId).toBe("class-1");
      expect(events[0].data.tokenId).toBe("token-1");
    });

    it("emits MEMBERSHIP_ADDED with required attributes", async () => {
      await stream.emitMembershipEvent(
        "MEMBERSHIP_ADDED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1member...",
        {
          groupAddr: "cosmos1group...",
          weight: 1,
        },
      );

      const events = memorySink.getEventsByType("MEMBERSHIP_ADDED");
      expect(events).toHaveLength(1);
      expect(events[0].data.memberAddress).toBe("cosmos1member...");
      expect(events[0].data.weight).toBe(1);
    });

    it("emits MEMBERSHIP_REMOVED with required attributes", async () => {
      await stream.emitMembershipEvent(
        "MEMBERSHIP_REMOVED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1member...",
        {
          groupAddr: "cosmos1group...",
        },
      );

      const events = memorySink.getEventsByType("MEMBERSHIP_REMOVED");
      expect(events).toHaveLength(1);
      expect(events[0].data.memberAddress).toBe("cosmos1member...");
    });

    it("emits MEMBERSHIP_UPDATED with required attributes", async () => {
      await stream.emitMembershipEvent(
        "MEMBERSHIP_UPDATED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1member...",
        {
          groupAddr: "cosmos1group...",
          oldWeight: 1,
          newWeight: 2,
        },
      );

      const events = memorySink.getEventsByType("MEMBERSHIP_UPDATED");
      expect(events).toHaveLength(1);
      expect(events[0].data.oldWeight).toBe(1);
      expect(events[0].data.newWeight).toBe(2);
    });

    it("emits EMERGENCY_PAUSED with required attributes", async () => {
      await stream.emitEmergencyEvent(
        "EMERGENCY_PAUSED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1admin...",
        {
          reason: "Security incident",
          autoUnpauseAt: Math.floor(Date.now() / 1000) + 86400,
        },
      );

      const events = memorySink.getEventsByType("EMERGENCY_PAUSED");
      expect(events).toHaveLength(1);
      expect(events[0].actor).toBe("cosmos1admin...");
      expect(events[0].data.reason).toBe("Security incident");
    });

    it("emits EMERGENCY_UNPAUSED with required attributes", async () => {
      await stream.emitEmergencyEvent(
        "EMERGENCY_UNPAUSED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1admin...",
        {},
      );

      const events = memorySink.getEventsByType("EMERGENCY_UNPAUSED");
      expect(events).toHaveLength(1);
      expect(events[0].actor).toBe("cosmos1admin...");
    });

    it("emits SAFE_MODE_ACTIVATED with required attributes", async () => {
      await stream.emitEmergencyEvent(
        "SAFE_MODE_ACTIVATED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1admin...",
        {
          newThreshold: 4,
          triggerReason: "Anomaly detected",
        },
      );

      const events = memorySink.getEventsByType("SAFE_MODE_ACTIVATED");
      expect(events).toHaveLength(1);
      expect(events[0].data.newThreshold).toBe(4);
    });

    it("emits SAFE_MODE_DEACTIVATED with required attributes", async () => {
      await stream.emitEmergencyEvent(
        "SAFE_MODE_DEACTIVATED",
        "cosmos1multisig...",
        "cosmoshub-4",
        "cosmos1admin...",
        {
          restoredThreshold: 2,
        },
      );

      const events = memorySink.getEventsByType("SAFE_MODE_DEACTIVATED");
      expect(events).toHaveLength(1);
      expect(events[0].data.restoredThreshold).toBe(2);
    });

    it("emits POLICY_VIOLATION with required attributes", async () => {
      await stream.emitPolicyEvent(
        "POLICY_VIOLATION",
        "cosmos1multisig...",
        "cosmoshub-4",
        "timelock-1",
        {
          violationType: "TIMELOCK_NOT_MET",
          proposalId: "42",
          details: "Must wait 2 more hours",
        },
      );

      const events = memorySink.getEventsByType("POLICY_VIOLATION");
      expect(events).toHaveLength(1);
      expect(events[0].data.policyId).toBe("timelock-1");
      expect(events[0].data.violationType).toBe("TIMELOCK_NOT_MET");
    });
  });

  describe("sink management", () => {
    it("adds and removes sinks", () => {
      const sink2 = createMemorySink("sink-2", "Second Sink");
      
      stream.addSink(sink2);
      expect(stream.getSinks()).toHaveLength(2);

      stream.removeSink("sink-2");
      expect(stream.getSinks()).toHaveLength(1);
    });

    it("emits to multiple sinks", async () => {
      const sink2 = createMemorySink("sink-2", "Second Sink");
      stream.addSink(sink2);

      await stream.emit({
        type: "PROPOSAL_CREATED",
        multisigAddress: "cosmos1test...",
        chainId: "cosmoshub-4",
        timestamp: Math.floor(Date.now() / 1000),
        data: {},
      });

      expect(memorySink.getEvents()).toHaveLength(1);
      expect(sink2.getEvents()).toHaveLength(1);
    });

    it("continues on sink failure", async () => {
      // Create a failing sink
      const failingSink = {
        id: "failing-sink",
        name: "Failing Sink",
        emit: jest.fn().mockRejectedValue(new Error("Sink failed")),
        isHealthy: jest.fn().mockResolvedValue(false),
      };

      stream.addSink(failingSink);

      // Should not throw
      await stream.emit({
        type: "PROPOSAL_CREATED",
        multisigAddress: "cosmos1test...",
        chainId: "cosmoshub-4",
        timestamp: Math.floor(Date.now() / 1000),
        data: {},
      });

      // Memory sink should still receive the event
      expect(memorySink.getEvents()).toHaveLength(1);
    });
  });

  describe("buffer", () => {
    it("maintains recent events in buffer", async () => {
      for (let i = 0; i < 10; i++) {
        await stream.emit({
          type: "PROPOSAL_CREATED",
          multisigAddress: "cosmos1test...",
          chainId: "cosmoshub-4",
          timestamp: Math.floor(Date.now() / 1000),
          data: { index: i },
        });
      }

      const recentEvents = stream.getRecentEvents(5);
      expect(recentEvents).toHaveLength(5);
    });

    it("filters events by type", async () => {
      await stream.emitProposalEvent("PROPOSAL_CREATED", "cosmos1...", "cosmoshub-4", "1");
      await stream.emitProposalEvent("PROPOSAL_EXECUTED", "cosmos1...", "cosmoshub-4", "1");
      await stream.emitProposalEvent("PROPOSAL_CREATED", "cosmos1...", "cosmoshub-4", "2");

      const createdEvents = stream.getEventsByType("PROPOSAL_CREATED");
      expect(createdEvents).toHaveLength(2);

      const executedEvents = stream.getEventsByType("PROPOSAL_EXECUTED");
      expect(executedEvents).toHaveLength(1);
    });

    it("filters events by multisig", async () => {
      await stream.emitProposalEvent("PROPOSAL_CREATED", "cosmos1multisig1...", "cosmoshub-4", "1");
      await stream.emitProposalEvent("PROPOSAL_CREATED", "cosmos1multisig2...", "cosmoshub-4", "2");
      await stream.emitProposalEvent("PROPOSAL_CREATED", "cosmos1multisig1...", "cosmoshub-4", "3");

      const multisig1Events = stream.getEventsByMultisig("cosmos1multisig1...");
      expect(multisig1Events).toHaveLength(2);
    });
  });
});

// ============================================================================
// Memory Sink Tests
// ============================================================================

describe("MemorySink", () => {
  let sink: MemorySink;

  beforeEach(() => {
    sink = createMemorySink("test", "Test Sink", 100);
  });

  it("stores events", async () => {
    const event: MultisigEvent = {
      id: "test-1",
      type: "PROPOSAL_CREATED",
      multisigAddress: "cosmos1...",
      chainId: "cosmoshub-4",
      timestamp: Math.floor(Date.now() / 1000),
      data: {},
    };

    await sink.emit(event);

    expect(sink.getEvents()).toHaveLength(1);
    expect(sink.getEvents()[0].id).toBe("test-1");
  });

  it("trims old events when max reached", async () => {
    const smallSink = createMemorySink("small", "Small Sink", 5);

    for (let i = 0; i < 10; i++) {
      await smallSink.emit({
        id: `test-${i}`,
        type: "PROPOSAL_CREATED",
        multisigAddress: "cosmos1...",
        chainId: "cosmoshub-4",
        timestamp: Math.floor(Date.now() / 1000),
        data: { index: i },
      });
    }

    const events = smallSink.getEvents();
    expect(events).toHaveLength(5);
    expect(events[0].data.index).toBe(5); // Oldest remaining
    expect(events[4].data.index).toBe(9); // Newest
  });

  it("clears events", async () => {
    await sink.emit({
      id: "test-1",
      type: "PROPOSAL_CREATED",
      multisigAddress: "cosmos1...",
      chainId: "cosmoshub-4",
      timestamp: Math.floor(Date.now() / 1000),
      data: {},
    });

    sink.clear();

    expect(sink.getEvents()).toHaveLength(0);
  });

  it("is always healthy", async () => {
    const healthy = await sink.isHealthy();
    expect(healthy).toBe(true);
  });
});

