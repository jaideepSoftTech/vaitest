import { Module } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        return new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
