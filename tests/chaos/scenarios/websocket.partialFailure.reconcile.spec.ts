import { ChaosHarness } from "../chaosHarness";
import { faultController } from "../faults";

type LocalStore = { proposalState: string; lastEventId: number };

async function fakeApplyWebsocketEvent(store: LocalStore, event: { id: number; state: string }) {
  // simulate drop
  if (Math.random() < faultController.state.websocketDropRate) return;
  store.lastEventId = event.id;
  store.proposalState = event.state;
}

async function fakeReconcileFromChain(_store: LocalStore) {
  // TODO: replace with your real "sync from chain" call
  // e.g. contract-engine query or REST endpoint
  return { canonicalState: "EXECUTED", canonicalEventId: 999 };
}

describe("CHAOS: websocket partial failure + reconciliation", () => {
  test("missing WS event is corrected by reconcile", async () => {
    const h = new ChaosHarness();

    await h.runScenario({
      name: "ws drop + reconcile",
      scenario: async (hh) => {
        const store: LocalStore = { proposalState: "OPEN", lastEventId: 0 };

        // drop half of WS events deterministically by setting a high drop rate
        faultController.state.websocketDropRate = 1; // drop all for this test

        hh.schedule(hh.now(), "ws event missed", async () => {
          await fakeApplyWebsocketEvent(store, { id: 10, state: "EXECUTED" });
          expect(store.proposalState).toBe("OPEN"); // still stale
        });

        hh.schedule(hh.now() + 1, "reconcile", async () => {
          await faultController.fire("onReconcile");
          const canonical = await fakeReconcileFromChain(store);
          store.proposalState = canonical.canonicalState;
          store.lastEventId = canonical.canonicalEventId;

          expect(store.proposalState).toBe("EXECUTED");
          expect(store.lastEventId).toBe(999);
        });
      },
    });
  });
});
