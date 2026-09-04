import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { AuthModule } from "./auth/auth.module";

// PlatformModule (Db/Queue/Cache/Storage/AiGateway/Driver/Secrets/Clock/Ids/
// Metering — 07-TEAM-BACKEND.md §2.4's L1 layer) and every domain module land
// on top of this bare skeleton starting Week 2. M0's job is only to prove
// the process boots and the health endpoint answers.
@Module({
  imports: [AuthModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
