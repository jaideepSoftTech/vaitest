import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global API prefix per Week 2 spec.
  app.setGlobalPrefix("api/v1");

  // Cookie parsing for refresh_token httpOnly cookie.
  app.use(cookieParser());

  // CORS with credentials for multi-origin auth flows.
  app.enableCors({
    credentials: true,
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
  });

  // Port map is fixed — see docs/runbooks/ports.md and .env.example.
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`[api] listening on :${port}`);
}

bootstrap();
