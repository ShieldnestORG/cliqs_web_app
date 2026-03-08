/**
 * Emergency Pause Controller Tests
 *
 * File: __tests__/policies/emergency-pause.test.ts
 *
 * Tests that the PauseController correctly blocks operations during
 * emergency pause and safe mode states.
 */

import { createPauseController, PauseController } from "@/lib/emergency/pause-controller";

// Mock the localDb module with unshared state
jest.mock("@/lib/localDb", () => {
  let mockDb: Record<string, any> = {};

  return {
    getEmergencyState: jest.fn((multisigAddress: string, chainId: string) => {
      return mockDb[`${multisigAddress}-${chainId}`] || null;
    }),
    updateEmergencyState: jest.fn((multisigAddress: string, chainId: string, updates: any) => {
      const key = `${multisigAddress}-${chainId}`;
      mockDb[key] = { ...mockDb[key], ...updates };
      return mockDb[key];
    }),
    recordEmergencyEvent: jest.fn(),
    __resetMockDb: () => {
      mockDb = {};
    },
  };
});

import * as localDb from "@/lib/localDb";

describe("Emergency Pause Controller", () => {
  let controller: PauseController;

  beforeEach(() => {
    (localDb as any).__resetMockDb();
    controller = createPauseController();
  });

  test("blocks operations when paused", async () => {
    const multisigAddr = "cosmos1multisig-test1";

    await controller.pause(multisigAddr, "cosmoshub-4", {
      actor: "admin",
      reason: "Security incident",
    });

    const blocked = controller.isOperationBlocked(multisigAddr, "cosmoshub-4", "approve");
    expect(blocked.blocked).toBe(true);
    expect(blocked.reason).toContain("Security incident");

    const blockedExecute = controller.isOperationBlocked(multisigAddr, "cosmoshub-4", "execute");
    expect(blockedExecute.blocked).toBe(true);
  });

  test("allows queries even when paused", async () => {
    const multisigAddr = "cosmos1multisig-test2";

    await controller.pause(multisigAddr, "cosmoshub-4", {
      actor: "admin",
      reason: "Security incident",
    });

    // The comment in the code says queries should always be allowed
    const allowed = controller.isOperationBlocked(multisigAddr, "cosmoshub-4", "query");
    expect(allowed.blocked).toBe(false);
  });

  test("unpause restores normal operation", async () => {
    const multisigAddr = "cosmos1multisig-test3";

    await controller.pause(multisigAddr, "cosmoshub-4", {
      actor: "admin",
      reason: "Security incident",
    });

    // Verify paused
    expect(controller.isOperationBlocked(multisigAddr, "cosmoshub-4", "approve").blocked).toBe(
      true,
    );

    await controller.unpause(multisigAddr, "cosmoshub-4", {
      actor: "admin",
      reason: "Incident resolved",
    });

    // Verify unpaused
    expect(controller.isOperationBlocked(multisigAddr, "cosmoshub-4", "approve").blocked).toBe(
      false,
    );
  });

  test("getState returns correct pause information", async () => {
    const multisigAddr = "cosmos1multisig-test4";

    const initialState = controller.getState(multisigAddr, "cosmoshub-4");
    expect(initialState.isPaused).toBe(false);

    await controller.pause(multisigAddr, "cosmoshub-4", {
      actor: "admin",
      reason: "Security incident",
    });

    const pausedState = controller.getState(multisigAddr, "cosmoshub-4");
    expect(pausedState.isPaused).toBe(true);
    expect(pausedState.pausedBy).toBe("admin");
    expect(pausedState.pauseReason).toBe("Security incident");
  });

  test("pause fails if already paused", async () => {
    const multisigAddr = "cosmos1multisig-test5";

    await controller.pause(multisigAddr, "cosmoshub-4", {
      actor: "admin",
      reason: "Security incident",
    });

    await expect(
      controller.pause(multisigAddr, "cosmoshub-4", {
        actor: "admin",
        reason: "Another incident",
      }),
    ).rejects.toThrow("already paused");
  });

  test("unpause fails if not paused", async () => {
    const multisigAddr = "cosmos1multisig-test6";

    // Unpause should fail if not paused
    await expect(
      controller.unpause(multisigAddr, "cosmoshub-4", {
        actor: "admin",
        reason: "Not actually paused",
      }),
    ).rejects.toThrow("not paused");
  });
});
