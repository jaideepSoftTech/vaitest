import { Controller, Get } from "@nestjs/common";

// W13 in 08-TEAM-SYSTEMS.md's shed-work table: "packages/shared/logger,
// correlation-context propagation with mandatory orgId, health + metrics
// endpoints" — SE-2, due Week 1, nothing blocked on it. This is the
// unauthenticated liveness probe; a deeper readiness check (DB round trip,
// Redis ping) is a Week 1-2 follow-up once PlatformDb/PlatformQueue exist.
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      service: "api",
      region: process.env.QA_REGION ?? "unknown",
      timestamp: new Date().toISOString(),
    };
  }
}
