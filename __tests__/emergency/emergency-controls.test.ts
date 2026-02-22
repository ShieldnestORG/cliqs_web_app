/**
 * Emergency Controls Tests
 * 
 * File: __tests__/emergency/emergency-controls.test.ts
 * 
 * Tests for Phase 4 emergency controls
 */

import {
  PauseController,
  SafeModeController,
  createPauseController,
  createSafeModeController,
  DEFAULT_EMERGENCY_STATE,
  EmergencyError,
} from "@/lib/emergency";

// Mock the localDb module
jest.mock("@/lib/localDb", () => ({
  getEmergencyState: jest.fn(),
  updateEmergencyState: jest.fn(),
  recordEmergencyEvent: jest.fn(),
}));

import * as localDb from "@/lib/localDb";

const mockLocalDb = localDb as jest.Mocked<typeof localDb>;

// ============================================================================
// Pause Controller Tests
// ============================================================================

describe("PauseController", () => {
  let controller: PauseController;
  const testMultisig = "cosmos1test...";
  const testChainId = "cosmoshub-4";

  beforeEach(() => {
    jest.clearAllMocks();
    controller = createPauseController();
    
    // Default to not paused
    mockLocalDb.getEmergencyState.mockReturnValue(null);
  });

  describe("getState", () => {
    it("returns default state when no state exists", () => {
      const state = controller.getState(testMultisig, testChainId);
      
      expect(state).toEqual(DEFAULT_EMERGENCY_STATE);
    });

    it("returns stored state when exists", () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: true,
        pausedAt: "2024-01-01T00:00:00.000Z",
        pausedBy: "cosmos1admin...",
        pauseReason: "Test pause",
        autoUnpauseAt: null,
        isSafeMode: false,
        safeModeThreshold: null,
        safeModeActivatedAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const state = controller.getState(testMultisig, testChainId);

      expect(state.isPaused).toBe(true);
      expect(state.pausedBy).toBe("cosmos1admin...");
      expect(state.pauseReason).toBe("Test pause");
    });
  });

  describe("pause", () => {
    it("pauses operations successfully", async () => {
      const result = await controller.pause(testMultisig, testChainId, {
        actor: "cosmos1admin...",
        reason: "Security incident",
      });

      expect(result.success).toBe(true);
      expect(result.pausedAt).toBeDefined();
      expect(result.autoUnpauseAt).toBeNull();

      expect(mockLocalDb.updateEmergencyState).toHaveBeenCalledWith(
        testMultisig,
        testChainId,
        expect.objectContaining({
          isPaused: true,
          pauseReason: "Security incident",
        }),
      );

      expect(mockLocalDb.recordEmergencyEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "pause",
          actor: "cosmos1admin...",
        }),
      );
    });

    it("pauses with auto-unpause duration", async () => {
      const result = await controller.pause(testMultisig, testChainId, {
        actor: "cosmos1admin...",
        reason: "Scheduled maintenance",
        durationSeconds: 3600, // 1 hour
      });

      expect(result.success).toBe(true);
      expect(result.autoUnpauseAt).toBeDefined();
      expect(result.autoUnpauseAt).toBeGreaterThan(result.pausedAt);
    });

    it("throws when already paused", async () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: true,
        pausedAt: "2024-01-01T00:00:00.000Z",
        pausedBy: "cosmos1admin...",
        pauseReason: "Already paused",
        autoUnpauseAt: null,
        isSafeMode: false,
        safeModeThreshold: null,
        safeModeActivatedAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      await expect(
        controller.pause(testMultisig, testChainId, {
          actor: "cosmos1admin...",
          reason: "Try again",
        }),
      ).rejects.toThrow(EmergencyError);
    });
  });

  describe("unpause", () => {
    beforeEach(() => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: true,
        pausedAt: "2024-01-01T00:00:00.000Z",
        pausedBy: "cosmos1admin...",
        pauseReason: "Test pause",
        autoUnpauseAt: null,
        isSafeMode: false,
        safeModeThreshold: null,
        safeModeActivatedAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
      });
    });

    it("unpauses successfully", async () => {
      const result = await controller.unpause(testMultisig, testChainId, {
        actor: "cosmos1admin...",
      });

      expect(result.success).toBe(true);
      expect(result.unpausedAt).toBeDefined();

      expect(mockLocalDb.updateEmergencyState).toHaveBeenCalledWith(
        testMultisig,
        testChainId,
        expect.objectContaining({
          isPaused: false,
          pausedAt: null,
          pausedBy: null,
        }),
      );
    });

    it("throws when not paused", async () => {
      mockLocalDb.getEmergencyState.mockReturnValue(null);

      await expect(
        controller.unpause(testMultisig, testChainId, {
          actor: "cosmos1admin...",
        }),
      ).rejects.toThrow(EmergencyError);
    });
  });

  describe("isOperationBlocked", () => {
    it("does not block queries when paused", () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: true,
        pausedAt: "2024-01-01T00:00:00.000Z",
        pausedBy: "cosmos1admin...",
        pauseReason: "Test pause",
        autoUnpauseAt: null,
        isSafeMode: false,
        safeModeThreshold: null,
        safeModeActivatedAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const result = controller.isOperationBlocked(
        testMultisig,
        testChainId,
        "query",
      );

      expect(result.blocked).toBe(false);
    });

    it("blocks approvals when paused", () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: true,
        pausedAt: "2024-01-01T00:00:00.000Z",
        pausedBy: "cosmos1admin...",
        pauseReason: "Test pause",
        autoUnpauseAt: null,
        isSafeMode: false,
        safeModeThreshold: null,
        safeModeActivatedAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const result = controller.isOperationBlocked(
        testMultisig,
        testChainId,
        "approve",
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("Test pause");
    });

    it("blocks execution when paused", () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: true,
        pausedAt: "2024-01-01T00:00:00.000Z",
        pausedBy: "cosmos1admin...",
        pauseReason: "Test pause",
        autoUnpauseAt: null,
        isSafeMode: false,
        safeModeThreshold: null,
        safeModeActivatedAt: null,
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const result = controller.isOperationBlocked(
        testMultisig,
        testChainId,
        "execute",
      );

      expect(result.blocked).toBe(true);
    });
  });

  describe("getUnpauseThreshold", () => {
    it("returns elevated threshold", () => {
      const result = controller.getUnpauseThreshold(2, 5);
      
      expect(result).toBe(3); // N+1
    });

    it("does not exceed total weight", () => {
      const result = controller.getUnpauseThreshold(5, 5);
      
      expect(result).toBe(5); // Can't exceed total
    });
  });
});

// ============================================================================
// Safe Mode Controller Tests
// ============================================================================

describe("SafeModeController", () => {
  let controller: SafeModeController;
  const testMultisig = "cosmos1test...";
  const testChainId = "cosmoshub-4";

  beforeEach(() => {
    jest.clearAllMocks();
    controller = createSafeModeController();
    
    mockLocalDb.getEmergencyState.mockReturnValue(null);
  });

  describe("getState", () => {
    it("returns not in safe mode by default", () => {
      const state = controller.getState(testMultisig, testChainId);
      
      expect(state.isSafeMode).toBe(false);
      expect(state.threshold).toBeNull();
    });

    it("returns active safe mode state", () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: false,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        autoUnpauseAt: null,
        isSafeMode: true,
        safeModeThreshold: 4,
        safeModeActivatedAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const state = controller.getState(testMultisig, testChainId);

      expect(state.isSafeMode).toBe(true);
      expect(state.threshold).toBe(4);
    });
  });

  describe("activate", () => {
    it("activates safe mode successfully", async () => {
      const result = await controller.activate(testMultisig, testChainId, 2, {
        actor: "cosmos1admin...",
        trigger: "manual",
        elevatedThreshold: 4,
        reason: "Suspicious activity",
      });

      expect(result.success).toBe(true);
      expect(result.previousThreshold).toBe(2);
      expect(result.newThreshold).toBe(4);

      expect(mockLocalDb.updateEmergencyState).toHaveBeenCalledWith(
        testMultisig,
        testChainId,
        expect.objectContaining({
          isSafeMode: true,
          safeModeThreshold: 4,
        }),
      );
    });

    it("throws when threshold is not elevated", async () => {
      await expect(
        controller.activate(testMultisig, testChainId, 3, {
          actor: "cosmos1admin...",
          trigger: "manual",
          elevatedThreshold: 2, // Less than normal
        }),
      ).rejects.toThrow(EmergencyError);
    });

    it("throws when already in safe mode", async () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: false,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        autoUnpauseAt: null,
        isSafeMode: true,
        safeModeThreshold: 4,
        safeModeActivatedAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      await expect(
        controller.activate(testMultisig, testChainId, 2, {
          actor: "cosmos1admin...",
          trigger: "manual",
          elevatedThreshold: 4,
        }),
      ).rejects.toThrow(EmergencyError);
    });
  });

  describe("deactivate", () => {
    beforeEach(() => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: false,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        autoUnpauseAt: null,
        isSafeMode: true,
        safeModeThreshold: 4,
        safeModeActivatedAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });
    });

    it("deactivates safe mode successfully", async () => {
      const result = await controller.deactivate(testMultisig, testChainId, 2, {
        actor: "cosmos1admin...",
        reason: "Situation resolved",
      });

      expect(result.success).toBe(true);
      expect(result.restoredThreshold).toBe(2);

      expect(mockLocalDb.updateEmergencyState).toHaveBeenCalledWith(
        testMultisig,
        testChainId,
        expect.objectContaining({
          isSafeMode: false,
          safeModeThreshold: null,
        }),
      );
    });

    it("throws when not in safe mode", async () => {
      mockLocalDb.getEmergencyState.mockReturnValue(null);

      await expect(
        controller.deactivate(testMultisig, testChainId, 2, {
          actor: "cosmos1admin...",
        }),
      ).rejects.toThrow(EmergencyError);
    });
  });

  describe("getEffectiveThreshold", () => {
    it("returns normal threshold when not in safe mode", () => {
      const result = controller.getEffectiveThreshold(
        testMultisig,
        testChainId,
        2,
      );

      expect(result).toBe(2);
    });

    it("returns elevated threshold when in safe mode", () => {
      mockLocalDb.getEmergencyState.mockReturnValue({
        id: "test-id",
        multisigAddress: testMultisig,
        chainId: testChainId,
        isPaused: false,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        autoUnpauseAt: null,
        isSafeMode: true,
        safeModeThreshold: 4,
        safeModeActivatedAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      });

      const result = controller.getEffectiveThreshold(
        testMultisig,
        testChainId,
        2,
      );

      expect(result).toBe(4);
    });
  });

  describe("calculateElevatedThreshold", () => {
    it("calculates based on severity", () => {
      const low = controller.calculateElevatedThreshold(2, 5, "low");
      const medium = controller.calculateElevatedThreshold(2, 5, "medium");
      const high = controller.calculateElevatedThreshold(2, 5, "high");
      const critical = controller.calculateElevatedThreshold(2, 5, "critical");

      expect(low).toBeLessThan(medium);
      expect(medium).toBeLessThan(high);
      expect(high).toBeLessThan(critical);
    });

    it("never exceeds total weight", () => {
      const result = controller.calculateElevatedThreshold(4, 5, "critical");
      
      expect(result).toBeLessThanOrEqual(5);
    });
  });
});

