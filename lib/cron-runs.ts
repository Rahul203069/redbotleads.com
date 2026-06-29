import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function createCronRun(path: string) {
  return prisma.cronRun.create({
    data: {
      path,
      status: "PROCESSING",
      message: "Cron execution started.",
    },
    select: {
      id: true,
    },
  });
}

export async function completeCronRun(cronRunId: string, message: string, stats?: unknown) {
  return updateCronRun(cronRunId, {
    status: "COMPLETED",
    message,
    completedAt: new Date(),
    statsJson: stats,
  });
}

export async function failCronRun(cronRunId: string, error: string, stats?: unknown) {
  return updateCronRun(cronRunId, {
    status: "FAILED",
    message: error,
    error,
    failedAt: new Date(),
    statsJson: stats,
  });
}

async function updateCronRun(
  cronRunId: string,
  data: {
    status: "PROCESSING" | "COMPLETED" | "FAILED";
    message: string;
    error?: string;
    completedAt?: Date;
    failedAt?: Date;
    statsJson?: unknown;
  },
) {
  const existing = data.statsJson === undefined
    ? null
    : await prisma.cronRun.findUnique({
        where: {
          id: cronRunId,
        },
        select: {
          statsJson: true,
        },
      });
  const statsJson =
    data.statsJson === undefined
      ? undefined
      : ({
          ...(isJsonObject(existing?.statsJson) ? existing.statsJson : {}),
          ...(isJsonObject(data.statsJson) ? data.statsJson : {}),
        } as Prisma.InputJsonValue);

  return prisma.cronRun.update({
    where: {
      id: cronRunId,
    },
    data: {
      status: data.status,
      message: data.message,
      error: data.error,
      completedAt: data.completedAt,
      failedAt: data.failedAt,
      statsJson,
    },
  });
}
