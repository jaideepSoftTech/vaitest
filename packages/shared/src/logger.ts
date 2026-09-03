// packages/shared/src/logger.ts
//
// W13 in 08-TEAM-SYSTEMS.md's shed-work table: "packages/shared/logger,
// correlation-context propagation with mandatory orgId". SE-2, Week 1.
// Full correlation-context (AsyncLocalStorage carrying orgId/correlationId
// through every log line) is a Week 1 follow-up; this is the base logger
// instance every process constructs its child logger from.
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { region: process.env.QA_REGION ?? "unknown" },
  transport:
    process.env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export type Logger = typeof logger;
