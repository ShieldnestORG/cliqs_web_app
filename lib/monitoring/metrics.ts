/**
 * Metrics Collector - Observability Infrastructure
 * 
 * File: lib/monitoring/metrics.ts
 * 
 * Collects and exports metrics for monitoring and observability.
 * Supports counters, gauges, and histograms.
 * 
 * Phase 4: Advanced Policies + Attack-Ready Safeguards
 */

// ============================================================================
// Metric Types
// ============================================================================

export type MetricType = "counter" | "gauge" | "histogram";

/**
 * Base metric interface
 */
export interface Metric {
  readonly name: string;
  readonly type: MetricType;
  readonly description: string;
  readonly labels: readonly string[];
  getValue(labels?: Record<string, string>): number | number[];
}

/**
 * Histogram bucket configuration
 */
export interface HistogramBuckets {
  readonly buckets: readonly number[];
}

// ============================================================================
// Metric Implementations
// ============================================================================

/**
 * Counter metric - monotonically increasing
 */
export class Counter implements Metric {
  readonly name: string;
  readonly type = "counter" as const;
  readonly description: string;
  readonly labels: readonly string[];
  
  private values: Map<string, number> = new Map();

  constructor(name: string, description: string, labels: string[] = []) {
    this.name = name;
    this.description = description;
    this.labels = labels;
  }

  /**
   * Increment the counter
   */
  inc(labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  /**
   * Get the current value
   */
  getValue(labels?: Record<string, string>): number {
    const key = this.getKey(labels);
    return this.values.get(key) ?? 0;
  }

  /**
   * Get all values with labels
   */
  getAll(): { labels: Record<string, string>; value: number }[] {
    const results: { labels: Record<string, string>; value: number }[] = [];
    
    for (const [key, value] of this.values) {
      results.push({
        labels: this.parseKey(key),
        value,
      });
    }
    
    return results;
  }

  private getKey(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "_default_";
    }
    return JSON.stringify(labels);
  }

  private parseKey(key: string): Record<string, string> {
    if (key === "_default_") {
      return {};
    }
    return JSON.parse(key);
  }
}

/**
 * Gauge metric - can go up or down
 */
export class Gauge implements Metric {
  readonly name: string;
  readonly type = "gauge" as const;
  readonly description: string;
  readonly labels: readonly string[];
  
  private values: Map<string, number> = new Map();

  constructor(name: string, description: string, labels: string[] = []) {
    this.name = name;
    this.description = description;
    this.labels = labels;
  }

  /**
   * Set the gauge value
   */
  set(value: number, labels?: Record<string, string>): void {
    const key = this.getKey(labels);
    this.values.set(key, value);
  }

  /**
   * Increment the gauge
   */
  inc(labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current + value);
  }

  /**
   * Decrement the gauge
   */
  dec(labels?: Record<string, string>, value: number = 1): void {
    const key = this.getKey(labels);
    const current = this.values.get(key) ?? 0;
    this.values.set(key, current - value);
  }

  /**
   * Get the current value
   */
  getValue(labels?: Record<string, string>): number {
    const key = this.getKey(labels);
    return this.values.get(key) ?? 0;
  }

  /**
   * Get all values with labels
   */
  getAll(): { labels: Record<string, string>; value: number }[] {
    const results: { labels: Record<string, string>; value: number }[] = [];
    
    for (const [key, value] of this.values) {
      results.push({
        labels: this.parseKey(key),
        value,
      });
    }
    
    return results;
  }

  private getKey(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "_default_";
    }
    return JSON.stringify(labels);
  }

  private parseKey(key: string): Record<string, string> {
    if (key === "_default_") {
      return {};
    }
    return JSON.parse(key);
  }
}

/**
 * Histogram metric - distribution of values
 */
export class Histogram implements Metric {
  readonly name: string;
  readonly type = "histogram" as const;
  readonly description: string;
  readonly labels: readonly string[];
  readonly buckets: readonly number[];
  
  private bucketValues: Map<string, number[]> = new Map();
  private sums: Map<string, number> = new Map();
  private counts: Map<string, number> = new Map();

  constructor(
    name: string,
    description: string,
    labels: string[] = [],
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    this.name = name;
    this.description = description;
    this.labels = labels;
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  /**
   * Observe a value
   */
  observe(value: number, labels?: Record<string, string>): void {
    const key = this.getKey(labels);
    
    // Update sum
    const currentSum = this.sums.get(key) ?? 0;
    this.sums.set(key, currentSum + value);
    
    // Update count
    const currentCount = this.counts.get(key) ?? 0;
    this.counts.set(key, currentCount + 1);
    
    // Update buckets
    let bucketCounts = this.bucketValues.get(key);
    if (!bucketCounts) {
      bucketCounts = new Array(this.buckets.length).fill(0);
      this.bucketValues.set(key, bucketCounts);
    }
    
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        bucketCounts[i]++;
      }
    }
  }

  /**
   * Get bucket values
   */
  getValue(labels?: Record<string, string>): number[] {
    const key = this.getKey(labels);
    return this.bucketValues.get(key) ?? new Array(this.buckets.length).fill(0);
  }

  /**
   * Get sum of observed values
   */
  getSum(labels?: Record<string, string>): number {
    const key = this.getKey(labels);
    return this.sums.get(key) ?? 0;
  }

  /**
   * Get count of observations
   */
  getCount(labels?: Record<string, string>): number {
    const key = this.getKey(labels);
    return this.counts.get(key) ?? 0;
  }

  /**
   * Get average
   */
  getAverage(labels?: Record<string, string>): number {
    const count = this.getCount(labels);
    if (count === 0) return 0;
    return this.getSum(labels) / count;
  }

  private getKey(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return "_default_";
    }
    return JSON.stringify(labels);
  }
}

// ============================================================================
// Metrics Registry
// ============================================================================

/**
 * Central registry for all metrics
 */
export class MetricsRegistry {
  private readonly metrics: Map<string, Metric> = new Map();
  private readonly prefix: string;

  constructor(prefix: string = "multisig") {
    this.prefix = prefix;
  }

  /**
   * Register a counter
   */
  counter(name: string, description: string, labels: string[] = []): Counter {
    const fullName = `${this.prefix}_${name}`;
    const existing = this.metrics.get(fullName);
    
    if (existing) {
      if (existing.type !== "counter") {
        throw new Error(`Metric ${fullName} already exists with different type`);
      }
      return existing as Counter;
    }
    
    const counter = new Counter(fullName, description, labels);
    this.metrics.set(fullName, counter);
    return counter;
  }

  /**
   * Register a gauge
   */
  gauge(name: string, description: string, labels: string[] = []): Gauge {
    const fullName = `${this.prefix}_${name}`;
    const existing = this.metrics.get(fullName);
    
    if (existing) {
      if (existing.type !== "gauge") {
        throw new Error(`Metric ${fullName} already exists with different type`);
      }
      return existing as Gauge;
    }
    
    const gauge = new Gauge(fullName, description, labels);
    this.metrics.set(fullName, gauge);
    return gauge;
  }

  /**
   * Register a histogram
   */
  histogram(
    name: string,
    description: string,
    labels: string[] = [],
    buckets?: number[],
  ): Histogram {
    const fullName = `${this.prefix}_${name}`;
    const existing = this.metrics.get(fullName);
    
    if (existing) {
      if (existing.type !== "histogram") {
        throw new Error(`Metric ${fullName} already exists with different type`);
      }
      return existing as Histogram;
    }
    
    const histogram = new Histogram(fullName, description, labels, buckets);
    this.metrics.set(fullName, histogram);
    return histogram;
  }

  /**
   * Get a metric by name
   */
  getMetric(name: string): Metric | undefined {
    const fullName = name.startsWith(this.prefix) ? name : `${this.prefix}_${name}`;
    return this.metrics.get(fullName);
  }

  /**
   * Get all registered metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Export metrics in a simple format
   */
  export(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    
    for (const [name, metric] of this.metrics) {
      if (metric.type === "counter" || metric.type === "gauge") {
        const m = metric as Counter | Gauge;
        result[name] = {
          type: metric.type,
          description: metric.description,
          values: m.getAll(),
        };
      } else if (metric.type === "histogram") {
        const h = metric as Histogram;
        result[name] = {
          type: metric.type,
          description: metric.description,
          buckets: h.buckets,
          values: h.getValue(),
          sum: h.getSum(),
          count: h.getCount(),
          average: h.getAverage(),
        };
      }
    }
    
    return result;
  }
}

// ============================================================================
// Pre-defined Metrics
// ============================================================================

/**
 * Create standard multisig metrics
 */
export function createStandardMetrics(registry: MetricsRegistry): {
  proposalsCreated: Counter;
  proposalsExecuted: Counter;
  proposalsFailed: Counter;
  signaturesCollected: Counter;
  policyViolations: Counter;
  emergencyPauses: Counter;
  activeMultisigs: Gauge;
  pendingProposals: Gauge;
  executionLatency: Histogram;
} {
  return {
    proposalsCreated: registry.counter(
      "proposals_created_total",
      "Total number of proposals created",
      ["chain_id"],
    ),
    proposalsExecuted: registry.counter(
      "proposals_executed_total",
      "Total number of proposals executed",
      ["chain_id"],
    ),
    proposalsFailed: registry.counter(
      "proposals_failed_total",
      "Total number of proposals that failed to execute",
      ["chain_id", "reason"],
    ),
    signaturesCollected: registry.counter(
      "signatures_collected_total",
      "Total number of signatures collected",
      ["chain_id"],
    ),
    policyViolations: registry.counter(
      "policy_violations_total",
      "Total number of policy violations",
      ["chain_id", "policy_type"],
    ),
    emergencyPauses: registry.counter(
      "emergency_pauses_total",
      "Total number of emergency pauses",
      ["chain_id"],
    ),
    activeMultisigs: registry.gauge(
      "active_multisigs",
      "Number of active multisigs",
      ["chain_id"],
    ),
    pendingProposals: registry.gauge(
      "pending_proposals",
      "Number of pending proposals",
      ["chain_id", "multisig_address"],
    ),
    executionLatency: registry.histogram(
      "execution_latency_seconds",
      "Time from proposal creation to execution",
      ["chain_id"],
      [60, 300, 900, 1800, 3600, 7200, 14400, 43200, 86400],
    ),
  };
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalRegistry: MetricsRegistry | null = null;

/**
 * Get the global metrics registry
 */
export function getMetricsRegistry(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
  }
  return globalRegistry;
}

/**
 * Set the global metrics registry
 */
export function setMetricsRegistry(registry: MetricsRegistry): void {
  globalRegistry = registry;
}

