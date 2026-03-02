/**
 * Event Streaming System - Guaranteed Event Emission
 *
 * File: lib/monitoring/event-stream.ts
 *
 * Implements the guaranteed event emission system for Phase 4.
 * Events are emitted to multiple sinks (webhook, WebSocket, etc.)
 *
 * Guaranteed Events (per Phase 4 requirements):
 * - PROPOSAL_QUEUED
 * - PROPOSAL_EXECUTED
 * - PROPOSAL_FAILED
 * - CREDENTIAL_MINTED
 * - CREDENTIAL_BURNED
 * - MEMBERSHIP_ADDED
 * - MEMBERSHIP_REMOVED
 * - MEMBERSHIP_UPDATED
 * - EMERGENCY_PAUSED
 * - EMERGENCY_UNPAUSED
 * - SAFE_MODE_ACTIVATED
 * - SAFE_MODE_DEACTIVATED
 * - POLICY_VIOLATION
 *
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

// ============================================================================
// Event Types
// ============================================================================

/**
 * All guaranteed event types
 */
export type MultisigEventType =
  // Proposal events
  | "PROPOSAL_CREATED"
  | "PROPOSAL_QUEUED"
  | "PROPOSAL_APPROVED"
  | "PROPOSAL_EXECUTED"
  | "PROPOSAL_FAILED"
  | "PROPOSAL_CANCELLED"
  // Credential events
  | "CREDENTIAL_MINTED"
  | "CREDENTIAL_BURNED"
  | "CREDENTIAL_FROZEN"
  | "CREDENTIAL_UNFROZEN"
  // Membership events
  | "MEMBERSHIP_ADDED"
  | "MEMBERSHIP_REMOVED"
  | "MEMBERSHIP_UPDATED"
  // Emergency events
  | "EMERGENCY_PAUSED"
  | "EMERGENCY_UNPAUSED"
  | "SAFE_MODE_ACTIVATED"
  | "SAFE_MODE_DEACTIVATED"
  // Policy events
  | "POLICY_CREATED"
  | "POLICY_UPDATED"
  | "POLICY_DELETED"
  | "POLICY_VIOLATION"
  // Alert events
  | "ALERT_TRIGGERED"
  | "INCIDENT_CREATED"
  | "INCIDENT_RESOLVED";

/**
 * Base event structure
 */
export interface MultisigEvent {
  /** Unique event ID */
  readonly id: string;
  /** Event type */
  readonly type: MultisigEventType;
  /** Multisig address */
  readonly multisigAddress: string;
  /** Chain ID */
  readonly chainId: string;
  /** Event timestamp (Unix seconds) */
  readonly timestamp: number;
  /** Block height (if applicable) */
  readonly height?: number;
  /** Transaction hash (if applicable) */
  readonly txHash?: string;
  /** Actor who triggered the event */
  readonly actor?: string;
  /** Event-specific data */
  readonly data: Record<string, unknown>;
}

// ============================================================================
// Event Sink Types
// ============================================================================

/**
 * Interface for event sinks
 */
export interface EventSink {
  /** Unique identifier for this sink */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Emit an event to this sink */
  emit(event: MultisigEvent): Promise<void>;
  /** Check if sink is healthy */
  isHealthy(): Promise<boolean>;
}

/**
 * Webhook event sink configuration
 */
export interface WebhookSinkConfig {
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
  readonly retries?: number;
}

/**
 * WebSocket event sink configuration
 */
export interface WebSocketSinkConfig {
  readonly url: string;
  readonly reconnect?: boolean;
  readonly reconnectInterval?: number;
}

// ============================================================================
// Event Sink Implementations
// ============================================================================

/**
 * Webhook event sink
 */
export class WebhookSink implements EventSink {
  readonly id: string;
  readonly name: string;
  private readonly config: WebhookSinkConfig;

  constructor(id: string, name: string, config: WebhookSinkConfig) {
    this.id = id;
    this.name = name;
    this.config = {
      timeout: 5000,
      retries: 3,
      ...config,
    };
  }

  async emit(event: MultisigEvent): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < (this.config.retries || 1); attempt++) {
      try {
        const response = await fetch(this.config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...this.config.headers,
          },
          body: JSON.stringify(event),
          signal: AbortSignal.timeout(this.config.timeout || 5000),
        });

        if (response.ok) {
          return;
        }

        lastError = new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Wait before retry
      if (attempt < (this.config.retries || 1) - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }

    console.error(`WebhookSink ${this.id} failed after retries:`, lastError);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(this.config.url, {
        method: "HEAD",
        signal: AbortSignal.timeout(2000),
      });
      return response.ok || response.status === 405; // 405 is OK for HEAD-not-allowed
    } catch {
      return false;
    }
  }
}

/**
 * In-memory event sink (for testing and local development)
 */
export class MemorySink implements EventSink {
  readonly id: string;
  readonly name: string;
  private events: MultisigEvent[] = [];
  private readonly maxEvents: number;

  constructor(id: string, name: string, maxEvents: number = 1000) {
    this.id = id;
    this.name = name;
    this.maxEvents = maxEvents;
  }

  async emit(event: MultisigEvent): Promise<void> {
    this.events.push(event);

    // Trim old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  getEvents(): MultisigEvent[] {
    return [...this.events];
  }

  getEventsByType(type: MultisigEventType): MultisigEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  getEventsByMultisig(multisigAddress: string): MultisigEvent[] {
    return this.events.filter((e) => e.multisigAddress === multisigAddress);
  }

  clear(): void {
    this.events = [];
  }
}

/**
 * Console event sink (for debugging)
 */
export class ConsoleSink implements EventSink {
  readonly id: string;
  readonly name: string;
  private readonly logLevel: "debug" | "info" | "warn";

  constructor(id: string, name: string, logLevel: "debug" | "info" | "warn" = "info") {
    this.id = id;
    this.name = name;
    this.logLevel = logLevel;
  }

  async emit(event: MultisigEvent): Promise<void> {
    const message = `[${event.type}] ${event.multisigAddress.slice(0, 12)}... - ${JSON.stringify(event.data)}`;

    switch (this.logLevel) {
      case "debug":
        console.debug(message);
        break;
      case "warn":
        console.warn(message);
        break;
      default:
        console.info(message);
    }
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

// ============================================================================
// Event Stream Implementation
// ============================================================================

/**
 * Central event streaming service
 */
export class EventStream {
  private readonly sinks: Map<string, EventSink> = new Map();
  private readonly eventBuffer: MultisigEvent[] = [];
  private readonly maxBufferSize: number;
  private isProcessing: boolean = false;

  constructor(maxBufferSize: number = 100) {
    this.maxBufferSize = maxBufferSize;
  }

  // ============================================================================
  // Sink Management
  // ============================================================================

  /**
   * Add an event sink
   */
  addSink(sink: EventSink): void {
    this.sinks.set(sink.id, sink);
  }

  /**
   * Remove an event sink
   */
  removeSink(sinkId: string): boolean {
    return this.sinks.delete(sinkId);
  }

  /**
   * Get all registered sinks
   */
  getSinks(): EventSink[] {
    return Array.from(this.sinks.values());
  }

  /**
   * Check health of all sinks
   */
  async checkHealth(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [id, sink] of this.sinks) {
      results.set(id, await sink.isHealthy());
    }

    return results;
  }

  // ============================================================================
  // Event Emission
  // ============================================================================

  /**
   * Emit an event to all sinks
   *
   * This is the main method for guaranteed event emission.
   * Events are buffered and processed asynchronously.
   */
  async emit(event: Omit<MultisigEvent, "id">): Promise<string> {
    const fullEvent: MultisigEvent = {
      ...event,
      id: this.generateEventId(),
    };

    // Add to buffer
    this.eventBuffer.push(fullEvent);

    // Trim buffer if too large
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }

    // Process event
    await this.processEvent(fullEvent);

    return fullEvent.id;
  }

  /**
   * Emit a proposal event
   */
  async emitProposalEvent(
    type:
      | "PROPOSAL_CREATED"
      | "PROPOSAL_QUEUED"
      | "PROPOSAL_APPROVED"
      | "PROPOSAL_EXECUTED"
      | "PROPOSAL_FAILED"
      | "PROPOSAL_CANCELLED",
    multisigAddress: string,
    chainId: string,
    proposalId: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return this.emit({
      type,
      multisigAddress,
      chainId,
      timestamp: Math.floor(Date.now() / 1000),
      data: { proposalId, ...data },
    });
  }

  /**
   * Emit a credential event
   */
  async emitCredentialEvent(
    type: "CREDENTIAL_MINTED" | "CREDENTIAL_BURNED" | "CREDENTIAL_FROZEN" | "CREDENTIAL_UNFROZEN",
    multisigAddress: string,
    chainId: string,
    classId: string,
    tokenId: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return this.emit({
      type,
      multisigAddress,
      chainId,
      timestamp: Math.floor(Date.now() / 1000),
      data: { classId, tokenId, ...data },
    });
  }

  /**
   * Emit a membership event
   */
  async emitMembershipEvent(
    type: "MEMBERSHIP_ADDED" | "MEMBERSHIP_REMOVED" | "MEMBERSHIP_UPDATED",
    multisigAddress: string,
    chainId: string,
    memberAddress: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return this.emit({
      type,
      multisigAddress,
      chainId,
      timestamp: Math.floor(Date.now() / 1000),
      data: { memberAddress, ...data },
    });
  }

  /**
   * Emit an emergency event
   */
  async emitEmergencyEvent(
    type:
      | "EMERGENCY_PAUSED"
      | "EMERGENCY_UNPAUSED"
      | "SAFE_MODE_ACTIVATED"
      | "SAFE_MODE_DEACTIVATED",
    multisigAddress: string,
    chainId: string,
    actor: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return this.emit({
      type,
      multisigAddress,
      chainId,
      timestamp: Math.floor(Date.now() / 1000),
      actor,
      data,
    });
  }

  /**
   * Emit a policy event
   */
  async emitPolicyEvent(
    type: "POLICY_CREATED" | "POLICY_UPDATED" | "POLICY_DELETED" | "POLICY_VIOLATION",
    multisigAddress: string,
    chainId: string,
    policyId: string,
    data: Record<string, unknown> = {},
  ): Promise<string> {
    return this.emit({
      type,
      multisigAddress,
      chainId,
      timestamp: Math.floor(Date.now() / 1000),
      data: { policyId, ...data },
    });
  }

  // ============================================================================
  // Event Processing
  // ============================================================================

  /**
   * Process an event by sending to all sinks
   */
  private async processEvent(event: MultisigEvent): Promise<void> {
    if (this.sinks.size === 0) {
      return;
    }

    const promises: Promise<void>[] = [];

    for (const sink of this.sinks.values()) {
      promises.push(
        sink.emit(event).catch((error) => {
          console.error(`Error emitting to sink ${sink.id}:`, error);
        }),
      );
    }

    await Promise.all(promises);
  }

  // ============================================================================
  // Buffer Access
  // ============================================================================

  /**
   * Get recent events from buffer
   */
  getRecentEvents(limit: number = 50): MultisigEvent[] {
    return this.eventBuffer.slice(-limit);
  }

  /**
   * Get events by type from buffer
   */
  getEventsByType(type: MultisigEventType, limit: number = 50): MultisigEvent[] {
    return this.eventBuffer.filter((e) => e.type === type).slice(-limit);
  }

  /**
   * Get events by multisig from buffer
   */
  getEventsByMultisig(multisigAddress: string, limit: number = 50): MultisigEvent[] {
    return this.eventBuffer.filter((e) => e.multisigAddress === multisigAddress).slice(-limit);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}_${random}`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an event stream
 */
export function createEventStream(maxBufferSize?: number): EventStream {
  return new EventStream(maxBufferSize);
}

/**
 * Create a webhook sink
 */
export function createWebhookSink(
  id: string,
  name: string,
  url: string,
  headers?: Record<string, string>,
): WebhookSink {
  return new WebhookSink(id, name, { url, headers });
}

/**
 * Create a memory sink
 */
export function createMemorySink(id: string, name: string, maxEvents?: number): MemorySink {
  return new MemorySink(id, name, maxEvents);
}

/**
 * Create a console sink
 */
export function createConsoleSink(
  id: string,
  name: string,
  logLevel?: "debug" | "info" | "warn",
): ConsoleSink {
  return new ConsoleSink(id, name, logLevel);
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalEventStream: EventStream | null = null;

/**
 * Get the global event stream
 */
export function getEventStream(): EventStream {
  if (!globalEventStream) {
    globalEventStream = new EventStream();
  }
  return globalEventStream;
}

/**
 * Set the global event stream
 */
export function setEventStream(stream: EventStream): void {
  globalEventStream = stream;
}
