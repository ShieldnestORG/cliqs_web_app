/**
 * Monitoring Module Exports
 * 
 * File: lib/monitoring/index.ts
 * 
 * Central export point for Phase 4 observability infrastructure.
 */

// Event Streaming
export {
  type MultisigEventType,
  type MultisigEvent,
  type EventSink,
  type WebhookSinkConfig,
  type WebSocketSinkConfig,
  WebhookSink,
  MemorySink,
  ConsoleSink,
  EventStream,
  createEventStream,
  createWebhookSink,
  createMemorySink,
  createConsoleSink,
  getEventStream,
  setEventStream,
} from "./event-stream";

// Metrics
export {
  type MetricType,
  type Metric,
  type HistogramBuckets,
  Counter,
  Gauge,
  Histogram,
  MetricsRegistry,
  createStandardMetrics,
  getMetricsRegistry,
  setMetricsRegistry,
} from "./metrics";

// Anomaly Detection
export {
  type AnomalyType,
  type AnomalySeverity,
  type Anomaly,
  type DetectionRule,
  type AnomalyResult,
  MembershipChurnRule,
  RepeatedFailuresRule,
  HighProposalFrequencyRule,
  CredentialRevocationSpikeRule,
  AnomalyDetector,
  createAnomalyDetector,
  createCustomAnomalyDetector,
  getAnomalyDetector,
  setAnomalyDetector,
} from "./anomaly-detector";

