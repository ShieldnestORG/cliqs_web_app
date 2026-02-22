/**
 * Layer 1: WebSocket Event Listener
 * 
 * File: lib/indexer/websocket-listener.ts
 * 
 * Real-time event listener for contract multisig events.
 * This layer provides fast UX updates and notifications.
 * 
 * IMPORTANT: Events from this layer are UNCONFIRMED.
 * Never mark state as "final" based on WebSocket events alone.
 * Layer 2 (sync job) is the authoritative source.
 * 
 * Architecture:
 * - Subscribe to Tendermint WebSocket
 * - Filter: tm.event = 'Tx' AND wasm._contract_address = <multisig>
 */

import * as crypto from "crypto";

/*
 * - Write temporary/unconfirmed records to DB
 * - Emit events for UI updates
 */

import { CW3EventType } from "../multisig/contract-types";
import * as localDb from "../localDb";

// ============================================================================
// Phase 2: CW4 Group Event Types
// ============================================================================

/**
 * Types of CW4 group events
 */
export type CW4EventType = 
  | "update_members"
  | "update_admin"
  | "add_hook"
  | "remove_hook";

/**
 * Combined event type for CW3 multisig and CW4 group events
 */
export type ContractEventType = CW3EventType | CW4EventType;

// ============================================================================
// Phase 3: Credential NFT Event Types
// ============================================================================

/**
 * Types of TX assetnft events for credentials
 */
export type CredentialEventType =
  | "credential_mint"
  | "credential_burn"
  | "credential_freeze"
  | "credential_unfreeze";

/**
 * All contract event types including credentials
 */
export type AllEventTypes = ContractEventType | CredentialEventType;

// ============================================================================
// Types
// ============================================================================

export interface WebSocketConfig {
  /** WebSocket endpoint (ws:// or wss://) */
  wsEndpoint: string;
  /** Chain ID for filtering */
  chainId: string;
  /** Contract addresses to watch (CW3 multisigs) */
  contractAddresses: string[];
  /** Group addresses to watch (CW4 groups) - Phase 2 */
  groupAddresses?: string[];
  /** Credential class IDs to watch (Phase 3) */
  credentialClassIds?: string[];
  /** Reconnection delay in ms */
  reconnectDelayMs?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
}

export interface ParsedEvent {
  type: ContractEventType | CredentialEventType;
  contractAddress: string;
  proposalId: number | null;
  txHash: string;
  height: number;
  attributes: Record<string, string>;
  timestamp: string;
  /** Whether this is a group event (Phase 2) */
  isGroupEvent?: boolean;
  /** Whether this is a credential event (Phase 3) */
  isCredentialEvent?: boolean;
  /** Credential class ID for credential events (Phase 3) */
  credentialClassId?: string;
  /** Token ID for credential events (Phase 3) */
  tokenId?: string;
}

export type EventCallback = (event: ParsedEvent) => void;

// ============================================================================
// WebSocketListener Class
// ============================================================================

export class WebSocketListener {
  private readonly config: WebSocketConfig;
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private eventCallbacks: Set<EventCallback> = new Set();
  private subscriptionId: string | null = null;

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectDelayMs: 5000,
      maxReconnectAttempts: 10,
      ...config,
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Start listening for events
   */
  async start(): Promise<void> {
    if (this.ws || this.isConnecting) {
      console.log("[WS] Already connected or connecting");
      return;
    }

    this.shouldReconnect = true;
    await this.connect();
  }

  /**
   * Stop listening and close connection
   */
  stop(): void {
    this.shouldReconnect = false;
    this.disconnect();
  }

  /**
   * Register a callback for events
   */
  onEvent(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      console.log(`[WS] Connecting to ${this.config.wsEndpoint}...`);
      
      // Create WebSocket connection
      this.ws = new WebSocket(this.config.wsEndpoint);

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.subscribe();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error("[WS] Error:", error);
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        this.ws = null;
        this.isConnecting = false;
        this.subscriptionId = null;

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error("[WS] Connection error:", error);
      this.isConnecting = false;
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscriptionId = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error("[WS] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelayMs || 5000;
    
    console.log(
      `[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect();
      }
    }, delay);
  }

  private subscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Build query for wasm contract events
    // We subscribe to all tx events and filter client-side
    const query = `tm.event = 'Tx'`;
    
    this.subscriptionId = `sub-${Date.now()}`;
    
    const subscribeMsg = {
      jsonrpc: "2.0",
      method: "subscribe",
      id: this.subscriptionId,
      params: {
        query,
      },
    };

    this.ws.send(JSON.stringify(subscribeMsg));
    console.log(`[WS] Subscribed with query: ${query}`);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle subscription confirmation
      if (message.id === this.subscriptionId && message.result) {
        console.log("[WS] Subscription confirmed");
        return;
      }

      // Handle events
      if (message.result?.data?.value?.TxResult) {
        this.processTxResult(message.result.data.value.TxResult);
      }
    } catch (error) {
      console.error("[WS] Failed to parse message:", error);
    }
  }

  private processTxResult(txResult: { height: number; tx: string; result?: { events?: { type: string; attributes: { key: string; value: string }[] }[] } }): void {
    const { height, tx, result } = txResult;
    const txHash = this.computeTxHash(tx);
    
    if (!result?.events) {
      return;
    }

    // Look for wasm events that match our contract addresses
    for (const event of result.events) {
      const attributes = this.parseEventAttributes(event.attributes);

      // Phase 3: Handle TX assetnft events for credentials
      if (event.type === "coreum.asset.nft.v1.EventMinted" ||
          event.type === "coreum.asset.nft.v1.EventBurnt" ||
          event.type === "coreum.asset.nft.v1.EventFrozen" ||
          event.type === "coreum.asset.nft.v1.EventUnfrozen") {
        
        const classId = attributes["class_id"] || attributes["classId"];
        
        // Check if this is one of our watched credential classes
        if (classId && this.config.credentialClassIds?.includes(classId)) {
          const parsedEvent = this.parseCredentialEvent(
            event.type,
            classId,
            attributes,
            txHash,
            height,
          );
          
          if (parsedEvent) {
            this.handleParsedEvent(parsedEvent);
          }
        }
        continue;
      }

      if (event.type !== "wasm") {
        continue;
      }

      const contractAddress = attributes["_contract_address"];

      // Check if this is one of our watched contracts (CW3 multisig)
      const isCW3Contract = contractAddress && this.config.contractAddresses.includes(contractAddress);
      
      // Check if this is one of our watched groups (CW4 group) - Phase 2
      const isCW4Group = contractAddress && this.config.groupAddresses?.includes(contractAddress);

      if (!isCW3Contract && !isCW4Group) {
        continue;
      }

      let parsedEvent: ParsedEvent | null = null;

      if (isCW3Contract) {
        parsedEvent = this.parseWasmEvent(
          contractAddress,
          attributes,
          txHash,
          height,
        );
      } else if (isCW4Group) {
        // Phase 2: Parse CW4 group events
        parsedEvent = this.parseCW4Event(
          contractAddress,
          attributes,
          txHash,
          height,
        );
      }

      if (parsedEvent) {
        this.handleParsedEvent(parsedEvent);
      }
    }
  }

  // ============================================================================
  // Phase 3: Credential Event Parsing
  // ============================================================================

  /**
   * Parse TX assetnft events for credentials
   */
  private parseCredentialEvent(
    eventType: string,
    classId: string,
    attributes: Record<string, string>,
    txHash: string,
    height: number,
  ): ParsedEvent | null {
    const tokenId = attributes["id"] || attributes["token_id"];
    const owner = attributes["owner"];

    let type: CredentialEventType;

    switch (eventType) {
      case "coreum.asset.nft.v1.EventMinted":
        type = "credential_mint";
        break;
      case "coreum.asset.nft.v1.EventBurnt":
        type = "credential_burn";
        break;
      case "coreum.asset.nft.v1.EventFrozen":
        type = "credential_freeze";
        break;
      case "coreum.asset.nft.v1.EventUnfrozen":
        type = "credential_unfreeze";
        break;
      default:
        return null;
    }

    return {
      type,
      contractAddress: classId, // Use classId as "contract" for credentials
      proposalId: null,
      txHash,
      height,
      attributes: {
        classId,
        tokenId: tokenId || "",
        owner: owner || "",
        ...attributes,
      },
      timestamp: new Date().toISOString(),
      isCredentialEvent: true,
      credentialClassId: classId,
      tokenId,
    };
  }

  private parseEventAttributes(
    attributes: { key: string; value: string }[]
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const attr of attributes) {
      // Tendermint events may be base64 encoded
      try {
        const key = this.decodeBase64IfNeeded(attr.key);
        const value = this.decodeBase64IfNeeded(attr.value);
        result[key] = value;
      } catch {
        result[attr.key] = attr.value;
      }
    }
    
    return result;
  }

  private decodeBase64IfNeeded(str: string): string {
    try {
      // Check if it looks like base64
      if (/^[A-Za-z0-9+/=]+$/.test(str) && str.length > 3) {
        const decoded = Buffer.from(str, "base64").toString("utf-8");
        // If decoded string is printable, use it
        if (/^[\x20-\x7E]+$/.test(decoded)) {
          return decoded;
        }
      }
    } catch {
      // Not base64
    }
    return str;
  }

  private parseWasmEvent(
    contractAddress: string,
    attributes: Record<string, string>,
    txHash: string,
    height: number,
  ): ParsedEvent | null {
    // Determine event type from action attribute or other indicators
    const action = attributes["action"] || attributes["method"];
    let eventType: CW3EventType | null = null;
    let proposalId: number | null = null;

    if (action === "propose" || attributes["proposal_id"] && !attributes["voter"]) {
      eventType = "propose";
    } else if (action === "vote" || attributes["voter"]) {
      eventType = "vote";
    } else if (action === "execute") {
      eventType = "execute";
    } else if (action === "close") {
      eventType = "close";
    }

    if (!eventType) {
      return null;
    }

    // Extract proposal_id
    if (attributes["proposal_id"]) {
      proposalId = parseInt(attributes["proposal_id"], 10);
    }

    return {
      type: eventType,
      contractAddress,
      proposalId,
      txHash,
      height,
      attributes,
      timestamp: new Date().toISOString(),
      isGroupEvent: false,
    };
  }

  /**
   * Phase 2: Parse CW4 group events
   */
  private parseCW4Event(
    groupAddress: string,
    attributes: Record<string, string>,
    txHash: string,
    height: number,
  ): ParsedEvent | null {
    const action = attributes["action"] || attributes["method"];
    let eventType: CW4EventType | null = null;

    if (action === "update_members" || attributes["add"] || attributes["remove"]) {
      eventType = "update_members";
    } else if (action === "update_admin") {
      eventType = "update_admin";
    } else if (action === "add_hook") {
      eventType = "add_hook";
    } else if (action === "remove_hook") {
      eventType = "remove_hook";
    }

    if (!eventType) {
      return null;
    }

    return {
      type: eventType,
      contractAddress: groupAddress,
      proposalId: null, // Groups don't have proposals
      txHash,
      height,
      attributes,
      timestamp: new Date().toISOString(),
      isGroupEvent: true,
    };
  }

  private handleParsedEvent(event: ParsedEvent): void {
    console.log(`[WS] Event: ${event.type}${event.isGroupEvent ? " (group)" : ""}${event.isCredentialEvent ? " (credential)" : ""} ${event.proposalId !== null ? `for proposal ${event.proposalId}` : ""}`);

    // Store event in database (unconfirmed)
    try {
      if (event.isCredentialEvent) {
        // Phase 3: Record credential event
        const credEventType = this.mapCredentialEventType(event.type as CredentialEventType);
        localDb.recordCredentialEvent({
          classId: event.credentialClassId || "",
          tokenId: event.tokenId || "",
          eventType: credEventType,
          actor: event.attributes["sender"] || event.attributes["owner"] || "",
          targetAddress: event.attributes["owner"] || event.attributes["recipient"] || null,
          txHash: event.txHash,
          height: event.height,
          chainId: this.config.chainId,
        });
      } else if (event.isGroupEvent) {
        // Phase 2: Record group event
        localDb.recordGroupEvent({
          groupAddress: event.contractAddress,
          chainId: this.config.chainId,
          eventType: event.type as "members_changed" | "admin_changed" | "hooks_changed",
          txHash: event.txHash,
          height: event.height,
          attributesJSON: JSON.stringify(event.attributes),
        });
      } else {
        // CW3 multisig event
        localDb.recordWebSocketEvent({
          contractAddress: event.contractAddress,
          chainId: this.config.chainId,
          eventType: event.type as CW3EventType,
          proposalId: event.proposalId,
          txHash: event.txHash,
          height: event.height,
          attributes: JSON.stringify(event.attributes),
        });
      }
    } catch (error) {
      console.error("[WS] Failed to record event:", error);
    }

    // Update cached state (unconfirmed)
    this.updateCachedState(event);

    // Notify callbacks
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[WS] Callback error:", error);
      }
    });
  }

  private updateCachedState(event: ParsedEvent): void {
    // Update local cache based on event type
    // These are UNCONFIRMED updates - Layer 2 will verify and correct
    try {
      switch (event.type) {
        case "propose":
          if (event.proposalId !== null) {
            // Create unconfirmed proposal record
            localDb.upsertContractProposal({
              contractAddress: event.contractAddress,
              chainId: this.config.chainId,
              proposalId: event.proposalId,
              title: event.attributes["title"] || "Pending...",
              description: event.attributes["description"] || "",
              msgsJSON: "[]", // Will be filled by sync job
              status: "pending",
              proposer: event.attributes["proposer"] || event.attributes["sender"] || "",
              expiresAt: null,
              createdHeight: event.height,
              lastVerifiedAt: new Date().toISOString(),
              isConfirmed: false, // IMPORTANT: Not confirmed yet
            });
          }
          break;

        case "vote":
          if (event.proposalId !== null) {
            const voter = event.attributes["voter"] || event.attributes["sender"];
            const vote = (event.attributes["vote"] || "yes") as "yes" | "no" | "abstain" | "veto";
            const weight = parseInt(event.attributes["weight"] || "1", 10);

            if (voter) {
              localDb.upsertContractVote({
                contractAddress: event.contractAddress,
                proposalId: event.proposalId,
                voter,
                vote,
                weight,
                txHash: event.txHash,
                height: event.height,
                isConfirmed: false,
              });
            }
          }
          break;

        case "execute":
          if (event.proposalId !== null) {
            localDb.updateContractProposalStatus(
              event.contractAddress,
              event.proposalId,
              "executed",
              false, // Not confirmed
            );
          }
          break;

        case "close":
          if (event.proposalId !== null) {
            // Could be rejected or expired
            localDb.updateContractProposalStatus(
              event.contractAddress,
              event.proposalId,
              "rejected",
              false,
            );
          }
          break;

        // Phase 2: CW4 Group events
        case "update_members":
          // Group membership changed - sync job will update the full state
          console.log(`[WS] Group ${event.contractAddress} members updated`);
          break;

        case "update_admin":
          // Group admin changed - update local cache
          console.log(`[WS] Group ${event.contractAddress} admin updated`);
          try {
            const newAdmin = event.attributes["admin"] || event.attributes["new_admin"] || null;
            localDb.updateGroup(this.config.chainId, event.contractAddress, {
              admin: newAdmin,
            });
          } catch {
            // Group might not be in DB yet
          }
          break;

        case "add_hook":
        case "remove_hook":
          // Hook changed - informational only
          console.log(`[WS] Group ${event.contractAddress} hooks changed`);
          break;

        // Phase 3: Credential events
        case "credential_mint":
          if (event.credentialClassId && event.tokenId) {
            console.log(`[WS] Credential minted: ${event.credentialClassId}:${event.tokenId}`);
            // The credential will be synced by the sync job
            // Here we just log and notify callbacks
          }
          break;

        case "credential_burn":
          if (event.credentialClassId && event.tokenId) {
            console.log(`[WS] Credential burned: ${event.credentialClassId}:${event.tokenId}`);
            // Update status to revoked
            try {
              localDb.updateCredentialStatus(
                event.credentialClassId,
                event.tokenId,
                "revoked",
                new Date().toISOString(),
              );
            } catch {
              // Credential might not be in DB yet
            }
          }
          break;

        case "credential_freeze":
          if (event.credentialClassId && event.tokenId) {
            console.log(`[WS] Credential frozen: ${event.credentialClassId}:${event.tokenId}`);
            // Note: We don't have an isFrozen field in DB, but we record the event
          }
          break;

        case "credential_unfreeze":
          if (event.credentialClassId && event.tokenId) {
            console.log(`[WS] Credential unfrozen: ${event.credentialClassId}:${event.tokenId}`);
          }
          break;
      }
    } catch (error) {
      console.error("[WS] Failed to update cached state:", error);
    }
  }

  /**
   * Phase 3: Map credential event type to DB event type
   */
  private mapCredentialEventType(type: CredentialEventType): "issued" | "revoked" | "frozen" | "unfrozen" {
    switch (type) {
      case "credential_mint":
        return "issued";
      case "credential_burn":
        return "revoked";
      case "credential_freeze":
        return "frozen";
      case "credential_unfreeze":
        return "unfrozen";
    }
  }

  private computeTxHash(txBase64: string): string {
    // In a real implementation, we'd compute the SHA256 hash of the tx bytes
    // For now, return a placeholder - the actual hash comes from the event
    try {
      const txBytes = new Uint8Array(Buffer.from(txBase64, "base64"));
      return crypto.createHash("sha256").update(txBytes).digest("hex").toUpperCase();
    } catch {
      return `tx-${Date.now()}`;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a WebSocket listener for contract events
 */
export function createWebSocketListener(
  config: WebSocketConfig
): WebSocketListener {
  return new WebSocketListener(config);
}

/**
 * Get WebSocket endpoint from RPC endpoint
 */
export function rpcToWsEndpoint(rpcEndpoint: string): string {
  let wsEndpoint = rpcEndpoint
    .replace("https://", "wss://")
    .replace("http://", "ws://");
  
  // Add /websocket path if not present
  if (!wsEndpoint.endsWith("/websocket")) {
    wsEndpoint = wsEndpoint.replace(/\/?$/, "/websocket");
  }
  
  return wsEndpoint;
}

// ============================================================================
// Singleton Manager (for app-wide listener)
// ============================================================================

class WebSocketManager {
  private listeners: Map<string, WebSocketListener> = new Map();

  /**
   * Get or create a listener for a chain
   */
  getListener(
    chainId: string,
    wsEndpoint: string,
    contractAddresses: string[]
  ): WebSocketListener {
    const key = chainId;
    
    let listener = this.listeners.get(key);
    if (!listener) {
      listener = createWebSocketListener({
        wsEndpoint,
        chainId,
        contractAddresses,
      });
      this.listeners.set(key, listener);
    } else {
      // Add new contract addresses if not already watching
      // Note: Would need to update the listener's contract list
    }
    
    return listener;
  }

  /**
   * Stop all listeners
   */
  stopAll(): void {
    this.listeners.forEach((listener) => {
      listener.stop();
    });
    this.listeners.clear();
  }
}

export const wsManager = new WebSocketManager();

