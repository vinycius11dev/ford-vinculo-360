import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async check() {
    const checks = { database: false, machineLearning: false };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }
    try {
      const endpoint = this.config.get<string>(
        "ML_SERVICE_URL",
        "http://127.0.0.1:8000",
      );
      const response = await fetch(`${endpoint}/health`, {
        signal: AbortSignal.timeout(1500),
      });
      checks.machineLearning = response.ok;
    } catch {
      checks.machineLearning = false;
    }
    return {
      status: checks.database
        ? checks.machineLearning
          ? "ok"
          : "degraded"
        : "unhealthy",
      service: "ford-vinculo-api",
      checks,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
