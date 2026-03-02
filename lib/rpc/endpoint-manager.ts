/**
 * RPC Endpoint Manager
 *
 * File: lib/rpc/endpoint-manager.ts
 *
 * Manages RPC endpoint configuration for multi-endpoint verification.
 * Supports priority-based endpoint selection and health monitoring.
 */

// ============================================================================
// Types
// ============================================================================

export type EndpointPriority = "primary" | "secondary" | "witness";
export type EndpointType = "private" | "public";

export interface RpcEndpoint {
  /** RPC URL */
  readonly url: string;
  /** Priority level */
  readonly priority: EndpointPriority;
  /** Whether this is a private (trusted) or public endpoint */
  readonly type: EndpointType;
  /** Optional label for display */
  readonly label?: string;
  /** Whether this endpoint is currently healthy */
  healthy?: boolean;
  /** Last response time in ms */
  lastResponseTime?: number;
  /** Last error if unhealthy */
  lastError?: string;
  /** Last health check timestamp */
  lastChecked?: string;
}

export interface EndpointConfig {
  /** Chain ID this configuration is for */
  readonly chainId: string;
  /** List of endpoints */
  readonly endpoints: RpcEndpoint[];
  /** Minimum number of confirmations required */
  readonly minConfirmations: number;
  /** Timeout for RPC calls in ms */
  readonly timeoutMs: number;
}

// ============================================================================
// EndpointManager Class
// ============================================================================

export class EndpointManager {
  private configs: Map<string, EndpointConfig> = new Map();

  /**
   * Add or update endpoint configuration for a chain
   */
  setConfig(chainId: string, config: Omit<EndpointConfig, "chainId">): void {
    this.configs.set(chainId, { ...config, chainId });
  }

  /**
   * Get configuration for a chain
   */
  getConfig(chainId: string): EndpointConfig | undefined {
    return this.configs.get(chainId);
  }

  /**
   * Create configuration from chain info
   */
  static fromChainInfo(
    chainId: string,
    nodeAddress: string,
    nodeAddresses?: readonly string[],
  ): EndpointConfig {
    const endpoints: RpcEndpoint[] = [];

    // Primary endpoint
    endpoints.push({
      url: nodeAddress,
      priority: "primary",
      type: "private", // Assume primary is trusted
      label: "Primary RPC",
    });

    // Additional endpoints as secondary/witness
    if (nodeAddresses) {
      nodeAddresses.forEach((url, index) => {
        if (url !== nodeAddress) {
          endpoints.push({
            url,
            priority: index === 0 ? "secondary" : "witness",
            type: "public",
            label: `RPC ${index + 2}`,
          });
        }
      });
    }

    return {
      chainId,
      endpoints,
      minConfirmations: Math.min(2, endpoints.length),
      timeoutMs: 30000,
    };
  }

  /**
   * Get healthy endpoints sorted by priority
   */
  getHealthyEndpoints(chainId: string): RpcEndpoint[] {
    const config = this.configs.get(chainId);
    if (!config) return [];

    return config.endpoints
      .filter((e) => e.healthy !== false)
      .sort((a, b) => {
        const priorityOrder: Record<EndpointPriority, number> = {
          primary: 0,
          secondary: 1,
          witness: 2,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Get primary endpoint for a chain
   */
  getPrimaryEndpoint(chainId: string): RpcEndpoint | undefined {
    const config = this.configs.get(chainId);
    if (!config) return undefined;

    return config.endpoints.find((e) => e.priority === "primary");
  }

  /**
   * Get witness endpoints (for verification)
   */
  getWitnessEndpoints(chainId: string): RpcEndpoint[] {
    const config = this.configs.get(chainId);
    if (!config) return [];

    return config.endpoints.filter((e) => e.priority === "witness" || e.priority === "secondary");
  }

  /**
   * Update endpoint health status
   */
  updateHealth(
    chainId: string,
    url: string,
    healthy: boolean,
    responseTime?: number,
    error?: string,
  ): void {
    const config = this.configs.get(chainId);
    if (!config) return;

    const endpoint = config.endpoints.find((e) => e.url === url);
    if (endpoint) {
      endpoint.healthy = healthy;
      endpoint.lastResponseTime = responseTime;
      endpoint.lastError = error;
      endpoint.lastChecked = new Date().toISOString();
    }
  }

  /**
   * Perform health check on all endpoints for a chain
   */
  async healthCheck(chainId: string): Promise<void> {
    const config = this.configs.get(chainId);
    if (!config) return;

    const checks = config.endpoints.map(async (endpoint) => {
      const start = Date.now();
      try {
        const response = await fetch(`${endpoint.url}/status`, {
          method: "GET",
          signal: AbortSignal.timeout(config.timeoutMs),
        });
        const responseTime = Date.now() - start;

        if (response.ok) {
          this.updateHealth(chainId, endpoint.url, true, responseTime);
        } else {
          this.updateHealth(chainId, endpoint.url, false, responseTime, `HTTP ${response.status}`);
        }
      } catch (error) {
        const responseTime = Date.now() - start;
        this.updateHealth(
          chainId,
          endpoint.url,
          false,
          responseTime,
          error instanceof Error ? error.message : "Unknown error",
        );
      }
    });

    await Promise.allSettled(checks);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let endpointManager: EndpointManager | null = null;

export function getEndpointManager(): EndpointManager {
  if (!endpointManager) {
    endpointManager = new EndpointManager();
  }
  return endpointManager;
}
