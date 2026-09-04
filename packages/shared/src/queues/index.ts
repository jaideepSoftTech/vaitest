// packages/shared/src/queues/index.ts
//
// BullMQ queue contract: queue names and configuration are frozen NOW (Week 2).
// These names and parameters are the public API that backend, worker, and agent
// teams code against. Changing a queue name or its config (concurrency, retries,
// timeouts, etc.) requires all consumers to update in lockstep.
//
// Queue/Worker instantiation (actually creating the connections) lands Week 5
// as part of the worker container implementation. This file is ONLY the contract.
//
// Redis key-namespace convention:
// - All app-level Redis keys MUST follow: {qa}:org:<uuid>:...
// - System keys use the allow-list: {qa}:sys:<purpose>:...
//   Examples:
//     - {qa}:sys:worker:hb:<workerId>  (worker heartbeat)
//     - {qa}:sys:metrics:queues         (queue metrics aggregation)
//     - {qa}:sys:lock:<jobId>           (distributed lock for idempotency)
// Never use bare Redis keys without the {qa} prefix. This is a tenancy boundary
// (see 09-MULTI-TENANCY.md). Cross-tenant isolation is enforced by the isolation
// harness (Week 3+), but the naming convention must be followed everywhere.

export const QUEUE_PREFIX = "{qa}";

export interface QueueConfig {
  concurrency: number;
  priorityRange?: { min: number; max: number };
  attempts: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  jobTimeoutMs: number;
  retention: {
    completed?: number;
    failed?: number;
    completedMs?: number; // for time-based retention (e.g., 14 days)
  };
}

export const QUEUES: Record<string, QueueConfig> = {
  // Execution pipeline queues
  "execution.test": {
    concurrency: 3,
    priorityRange: { min: 1, max: 4 },
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    jobTimeoutMs: 300000,
    retention: { completed: 200, failed: 5000 },
  },
  "execution.test.fast": {
    concurrency: 1,
    priorityRange: { min: 1, max: 4 },
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    jobTimeoutMs: 300000,
    retention: { completed: 200, failed: 5000 },
  },
  "execution.orchestrate": {
    concurrency: 8,
    priorityRange: { min: 1, max: 1 },
    attempts: 3,
    backoff: { type: "fixed", delay: 2000 },
    jobTimeoutMs: 30000,
    retention: { completed: 500, failed: 5000 },
  },

  // Exploration and discovery queues
  "exploration.crawl": {
    concurrency: 1,
    priorityRange: { min: 3, max: 3 },
    attempts: 1,
    jobTimeoutMs: 1800000,
    retention: { completed: 100, failed: 1000 },
  },

  // Agent execution queues
  "agent.run": {
    concurrency: 4,
    priorityRange: { min: 2, max: 2 },
    attempts: 2,
    backoff: { type: "exponential", delay: 10000 },
    jobTimeoutMs: 180000,
    retention: { completed: 500, failed: 5000 },
  },
  "agent.tenant": {
    concurrency: 2,
    priorityRange: { min: 4, max: 4 },
    attempts: 1,
    jobTimeoutMs: 120000,
    retention: { completed: 500, failed: 5000 },
  },

  // Artifact and upload queues
  "artifact.upload": {
    concurrency: 8,
    priorityRange: { min: 1, max: 1 },
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    jobTimeoutMs: 120000,
    retention: { completed: 1000, failed: 10000 },
  },

  // Maintenance and administrative queues
  maintenance: {
    concurrency: 2,
    priorityRange: { min: 5, max: 5 },
    attempts: 1,
    jobTimeoutMs: 900000,
    retention: { completed: 100, failed: 500 },
  },
  "tenant.lifecycle": {
    concurrency: 1,
    priorityRange: { min: 5, max: 5 },
    attempts: 3,
    backoff: { type: "fixed", delay: 60000 },
    jobTimeoutMs: 3600000,
    retention: { completed: 200, failed: 1000 },
  },

  // Dead letter queue (no consumer; time-based retention)
  "system.dlq": {
    concurrency: 0, // No worker consumes this queue
    priorityRange: { min: 5, max: 5 },
    attempts: 1,
    jobTimeoutMs: 3600000,
    retention: { completedMs: 14 * 24 * 60 * 60 * 1000 }, // 14 days in milliseconds
  },
};
