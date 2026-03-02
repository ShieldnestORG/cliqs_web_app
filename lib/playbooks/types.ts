/**
 * Incident Playbooks - Automated Response Sequences
 *
 * File: lib/playbooks/types.ts
 *
 * Defines types and implementations for automated incident response.
 * Playbooks are sequences of actions executed in response to incidents.
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

import { Anomaly } from "@/lib/monitoring/anomaly-detector";

// ============================================================================
// Playbook Types
// ============================================================================

export type PlaybookStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/**
 * Playbook definition
 */
export interface Playbook {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly triggerConditions: PlaybookTrigger[];
  readonly steps: PlaybookStep[];
  readonly enabled: boolean;
  readonly requiresApproval: boolean;
  readonly timeout: number; // seconds
}

/**
 * Conditions that trigger a playbook
 */
export interface PlaybookTrigger {
  readonly type: "anomaly" | "event" | "incident" | "manual";
  readonly conditions: Record<string, unknown>;
}

/**
 * Single step in a playbook
 */
export interface PlaybookStep {
  readonly id: string;
  readonly name: string;
  readonly action: PlaybookAction;
  readonly params: Record<string, unknown>;
  readonly onFailure: "continue" | "stop" | "retry";
  readonly retries?: number;
  readonly timeout?: number;
}

/**
 * Available playbook actions
 */
export type PlaybookAction =
  | "pause_multisig"
  | "activate_safe_mode"
  | "send_alert"
  | "create_incident"
  | "notify_team"
  | "wait"
  | "check_condition"
  | "custom";

/**
 * Playbook execution context
 */
export interface PlaybookContext {
  readonly playbookId: string;
  readonly executionId: string;
  readonly triggeredBy: string;
  readonly triggeredAt: number;
  readonly multisigAddress: string;
  readonly chainId: string;
  readonly triggerData: Record<string, unknown>;
}

/**
 * Step execution result
 */
export interface StepResult {
  readonly stepId: string;
  readonly status: "success" | "failure" | "skipped";
  readonly output?: Record<string, unknown>;
  readonly error?: string;
  readonly duration: number;
}

/**
 * Playbook execution result
 */
export interface PlaybookResult {
  readonly executionId: string;
  readonly playbookId: string;
  readonly status: PlaybookStatus;
  readonly startedAt: number;
  readonly completedAt: number | null;
  readonly stepResults: StepResult[];
  readonly error?: string;
}

// ============================================================================
// Playbook Runner
// ============================================================================

/**
 * Step action handler type
 */
export type StepHandler = (step: PlaybookStep, context: PlaybookContext) => Promise<StepResult>;

/**
 * Playbook runner
 */
export class PlaybookRunner {
  private readonly playbooks: Map<string, Playbook> = new Map();
  private readonly handlers: Map<PlaybookAction, StepHandler> = new Map();
  private readonly executions: Map<string, PlaybookResult> = new Map();

  constructor() {
    this.registerDefaultHandlers();
  }

  // ============================================================================
  // Playbook Management
  // ============================================================================

  /**
   * Register a playbook
   */
  registerPlaybook(playbook: Playbook): void {
    this.playbooks.set(playbook.id, playbook);
  }

  /**
   * Unregister a playbook
   */
  unregisterPlaybook(playbookId: string): boolean {
    return this.playbooks.delete(playbookId);
  }

  /**
   * Get a playbook
   */
  getPlaybook(playbookId: string): Playbook | undefined {
    return this.playbooks.get(playbookId);
  }

  /**
   * Get all playbooks
   */
  getAllPlaybooks(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  // ============================================================================
  // Handler Registration
  // ============================================================================

  /**
   * Register a step handler
   */
  registerHandler(action: PlaybookAction, handler: StepHandler): void {
    this.handlers.set(action, handler);
  }

  private registerDefaultHandlers(): void {
    // Wait action
    this.handlers.set("wait", async (step, _context) => {
      const duration = (step.params.seconds as number) || 0;
      await new Promise((resolve) => setTimeout(resolve, duration * 1000));
      return {
        stepId: step.id,
        status: "success",
        duration,
      };
    });

    // Check condition action
    this.handlers.set("check_condition", async (step, _context) => {
      const condition = step.params.condition as string;
      // Simple condition evaluation (expand as needed)
      const result = condition === "true";
      return {
        stepId: step.id,
        status: result ? "success" : "failure",
        output: { condition, result },
        duration: 0,
      };
    });

    // Send alert action
    this.handlers.set("send_alert", async (step, context) => {
      console.log(`[Playbook ${context.playbookId}] Alert: ${step.params.message}`);
      return {
        stepId: step.id,
        status: "success",
        output: { message: step.params.message },
        duration: 0,
      };
    });

    // Create incident action
    this.handlers.set("create_incident", async (step, context) => {
      console.log(`[Playbook ${context.playbookId}] Creating incident: ${step.params.title}`);
      return {
        stepId: step.id,
        status: "success",
        output: { incidentId: `inc_${Date.now()}` },
        duration: 0,
      };
    });

    // Pause multisig action
    this.handlers.set("pause_multisig", async (step, context) => {
      console.log(`[Playbook ${context.playbookId}] Pausing multisig: ${context.multisigAddress}`);
      // Actual pause would be implemented with PauseController
      return {
        stepId: step.id,
        status: "success",
        output: { paused: true },
        duration: 0,
      };
    });

    // Activate safe mode action
    this.handlers.set("activate_safe_mode", async (step, context) => {
      console.log(
        `[Playbook ${context.playbookId}] Activating safe mode: ${context.multisigAddress}`,
      );
      // Actual safe mode would be implemented with SafeModeController
      return {
        stepId: step.id,
        status: "success",
        output: { safeModeActive: true },
        duration: 0,
      };
    });

    // Notify team action
    this.handlers.set("notify_team", async (step, context) => {
      console.log(`[Playbook ${context.playbookId}] Notifying team: ${step.params.channel}`);
      return {
        stepId: step.id,
        status: "success",
        output: { notified: true },
        duration: 0,
      };
    });
  }

  // ============================================================================
  // Execution
  // ============================================================================

  /**
   * Execute a playbook
   */
  async execute(
    playbookId: string,
    multisigAddress: string,
    chainId: string,
    triggeredBy: string,
    triggerData: Record<string, unknown> = {},
  ): Promise<PlaybookResult> {
    const playbook = this.playbooks.get(playbookId);
    if (!playbook) {
      throw new Error(`Playbook not found: ${playbookId}`);
    }

    if (!playbook.enabled) {
      throw new Error(`Playbook is disabled: ${playbookId}`);
    }

    const executionId = this.generateExecutionId();
    const startedAt = Math.floor(Date.now() / 1000);

    const context: PlaybookContext = {
      playbookId,
      executionId,
      triggeredBy,
      triggeredAt: startedAt,
      multisigAddress,
      chainId,
      triggerData,
    };

    const result: PlaybookResult = {
      executionId,
      playbookId,
      status: "running",
      startedAt,
      completedAt: null,
      stepResults: [],
    };

    this.executions.set(executionId, result);

    try {
      for (const step of playbook.steps) {
        const stepResult = await this.executeStep(step, context);
        result.stepResults.push(stepResult);

        if (stepResult.status === "failure") {
          if (step.onFailure === "stop") {
            return this.completeExecution(executionId, "failed", stepResult.error);
          }
          // continue or retry logic here
        }
      }

      return this.completeExecution(executionId, "completed");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.completeExecution(executionId, "failed", errorMessage);
    }
  }

  private async executeStep(step: PlaybookStep, context: PlaybookContext): Promise<StepResult> {
    const handler = this.handlers.get(step.action);

    if (!handler) {
      return {
        stepId: step.id,
        status: "failure",
        error: `No handler for action: ${step.action}`,
        duration: 0,
      };
    }

    const startTime = Date.now();

    try {
      const result = await handler(step, context);
      return {
        ...result,
        duration: (Date.now() - startTime) / 1000,
      };
    } catch (error) {
      return {
        stepId: step.id,
        status: "failure",
        error: error instanceof Error ? error.message : String(error),
        duration: (Date.now() - startTime) / 1000,
      };
    }
  }

  private completeExecution(
    executionId: string,
    status: PlaybookStatus,
    error?: string,
  ): PlaybookResult {
    const result = this.executions.get(executionId);
    if (!result) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const completed: PlaybookResult = {
      ...result,
      status,
      completedAt: Math.floor(Date.now() / 1000),
      error,
    };

    this.executions.set(executionId, completed);
    return completed;
  }

  // ============================================================================
  // Trigger Matching
  // ============================================================================

  /**
   * Find playbooks that should be triggered by an anomaly
   */
  findPlaybooksForAnomaly(anomaly: Anomaly): Playbook[] {
    return Array.from(this.playbooks.values()).filter((playbook) => {
      if (!playbook.enabled) return false;

      return playbook.triggerConditions.some((trigger) => {
        if (trigger.type !== "anomaly") return false;

        const requiredType = trigger.conditions.anomalyType as string;
        if (requiredType && requiredType !== anomaly.type) return false;

        const minSeverity = trigger.conditions.minSeverity as string;
        if (minSeverity) {
          const severityOrder = ["low", "medium", "high", "critical"];
          const anomalySeverityIndex = severityOrder.indexOf(anomaly.severity);
          const minSeverityIndex = severityOrder.indexOf(minSeverity);
          if (anomalySeverityIndex < minSeverityIndex) return false;
        }

        return true;
      });
    });
  }

  // ============================================================================
  // Query
  // ============================================================================

  /**
   * Get execution status
   */
  getExecution(executionId: string): PlaybookResult | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get recent executions
   */
  getRecentExecutions(limit: number = 50): PlaybookResult[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private generateExecutionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `exec_${timestamp}_${random}`;
  }
}

// ============================================================================
// Pre-defined Playbooks
// ============================================================================

/**
 * Emergency response playbook
 */
export const EMERGENCY_RESPONSE_PLAYBOOK: Playbook = {
  id: "emergency_response",
  name: "Emergency Response",
  description: "Automatically responds to critical anomalies by pausing and alerting",
  triggerConditions: [
    {
      type: "anomaly",
      conditions: {
        minSeverity: "critical",
      },
    },
  ],
  steps: [
    {
      id: "pause",
      name: "Pause Multisig",
      action: "pause_multisig",
      params: { reason: "Automated emergency response" },
      onFailure: "continue",
    },
    {
      id: "alert",
      name: "Send Critical Alert",
      action: "send_alert",
      params: { message: "Critical anomaly detected - multisig paused" },
      onFailure: "continue",
    },
    {
      id: "incident",
      name: "Create Incident",
      action: "create_incident",
      params: { title: "Critical Anomaly", severity: "critical" },
      onFailure: "continue",
    },
    {
      id: "notify",
      name: "Notify Team",
      action: "notify_team",
      params: { channel: "emergency" },
      onFailure: "continue",
    },
  ],
  enabled: true,
  requiresApproval: false,
  timeout: 60,
};

/**
 * Safe mode activation playbook
 */
export const SAFE_MODE_PLAYBOOK: Playbook = {
  id: "safe_mode_activation",
  name: "Safe Mode Activation",
  description: "Activates safe mode in response to high-severity anomalies",
  triggerConditions: [
    {
      type: "anomaly",
      conditions: {
        minSeverity: "high",
        anomalyType: "credential_revocation_spike",
      },
    },
  ],
  steps: [
    {
      id: "safe_mode",
      name: "Activate Safe Mode",
      action: "activate_safe_mode",
      params: { thresholdIncrease: 1 },
      onFailure: "stop",
    },
    {
      id: "alert",
      name: "Send Alert",
      action: "send_alert",
      params: { message: "Safe mode activated due to credential activity" },
      onFailure: "continue",
    },
  ],
  enabled: true,
  requiresApproval: false,
  timeout: 30,
};

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a playbook runner with default playbooks
 */
export function createPlaybookRunner(): PlaybookRunner {
  const runner = new PlaybookRunner();
  runner.registerPlaybook(EMERGENCY_RESPONSE_PLAYBOOK);
  runner.registerPlaybook(SAFE_MODE_PLAYBOOK);
  return runner;
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalPlaybookRunner: PlaybookRunner | null = null;

/**
 * Get the global playbook runner
 */
export function getPlaybookRunner(): PlaybookRunner {
  if (!globalPlaybookRunner) {
    globalPlaybookRunner = createPlaybookRunner();
  }
  return globalPlaybookRunner;
}

/**
 * Set the global playbook runner
 */
export function setPlaybookRunner(runner: PlaybookRunner): void {
  globalPlaybookRunner = runner;
}
