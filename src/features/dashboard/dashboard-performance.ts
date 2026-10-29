import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

type DashboardPerformanceStage =
  | "authentication"
  | "authorization"
  | "rooms"
  | "sync-logs"
  | "cleaning"
  | "conflicts";

interface StageMetrics {
  wallTimeMs: number;
  prismaOperationCount: number;
  prismaOperationTimeMs: number;
  prismaOperations: Record<string, {
    count: number;
    totalTimeMs: number;
    maxTimeMs: number;
  }>;
}

interface DashboardPerformanceTrace {
  id: string;
  startedAt: number;
  stages: Map<DashboardPerformanceStage | "unattributed", StageMetrics>;
}

interface DashboardPerformanceContext {
  trace: DashboardPerformanceTrace;
  stage: DashboardPerformanceStage | "unattributed";
}

const dashboardPerformanceStorage = new AsyncLocalStorage<DashboardPerformanceContext>();

const isDashboardPerformanceEnabled = () => {
  const configured = process.env.DASHBOARD_PERFORMANCE_LOG?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return process.env.NODE_ENV === "development";
};

function emptyStageMetrics(): StageMetrics {
  return {
    wallTimeMs: 0,
    prismaOperationCount: 0,
    prismaOperationTimeMs: 0,
    prismaOperations: {},
  };
}

function getStageMetrics(
  trace: DashboardPerformanceTrace,
  stage: DashboardPerformanceStage | "unattributed",
) {
  const current = trace.stages.get(stage);
  if (current) return current;
  const created = emptyStageMetrics();
  trace.stages.set(stage, created);
  return created;
}

const roundMilliseconds = (value: number) => Math.round(value * 100) / 100;

export async function withDashboardPerformanceTrace<T>(operation: () => Promise<T>): Promise<T> {
  if (!isDashboardPerformanceEnabled()) return operation();

  const trace: DashboardPerformanceTrace = {
    id: randomUUID(),
    startedAt: performance.now(),
    stages: new Map(),
  };
  let outcome: "success" | "error" = "success";

  try {
    return await dashboardPerformanceStorage.run({ trace, stage: "unattributed" }, operation);
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    const stages = Object.fromEntries(
      [...trace.stages.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([stage, metrics]) => [stage, {
          wallTimeMs: roundMilliseconds(metrics.wallTimeMs),
          prismaOperationCount: metrics.prismaOperationCount,
          prismaOperationTimeMs: roundMilliseconds(metrics.prismaOperationTimeMs),
          prismaOperations: Object.fromEntries(Object.entries(metrics.prismaOperations).map(([operation, value]) => [operation, {
            count: value.count,
            totalTimeMs: roundMilliseconds(value.totalTimeMs),
            maxTimeMs: roundMilliseconds(value.maxTimeMs),
          }])),
        }]),
    );
    const totals = [...trace.stages.values()].reduce((result, metrics) => ({
      prismaOperationCount: result.prismaOperationCount + metrics.prismaOperationCount,
      prismaOperationTimeMs: result.prismaOperationTimeMs + metrics.prismaOperationTimeMs,
    }), { prismaOperationCount: 0, prismaOperationTimeMs: 0 });

    // Deliberately exclude user, company, SQL text and query parameters.
    console.info("[dashboard.performance]", JSON.stringify({
      traceId: trace.id,
      outcome,
      totalTimeMs: roundMilliseconds(performance.now() - trace.startedAt),
      prismaOperationCount: totals.prismaOperationCount,
      prismaOperationTimeMs: roundMilliseconds(totals.prismaOperationTimeMs),
      stages,
    }));
  }
}

export async function measureDashboardStage<T>(
  stage: DashboardPerformanceStage,
  operation: () => Promise<T>,
): Promise<T> {
  const current = dashboardPerformanceStorage.getStore();
  if (!current) return operation();

  const startedAt = performance.now();
  try {
    return await dashboardPerformanceStorage.run({ trace: current.trace, stage }, operation);
  } finally {
    getStageMetrics(current.trace, stage).wallTimeMs += performance.now() - startedAt;
  }
}

export function recordDashboardPrismaOperation(
  model: string | undefined,
  operation: string,
  durationMs: number,
) {
  const current = dashboardPerformanceStorage.getStore();
  if (!current) return;

  const metrics = getStageMetrics(current.trace, current.stage);
  const operationName = `${model ?? "Prisma"}.${operation}`;
  metrics.prismaOperationCount += 1;
  metrics.prismaOperationTimeMs += durationMs;
  const operationMetrics = metrics.prismaOperations[operationName] ?? { count: 0, totalTimeMs: 0, maxTimeMs: 0 };
  operationMetrics.count += 1;
  operationMetrics.totalTimeMs += durationMs;
  operationMetrics.maxTimeMs = Math.max(operationMetrics.maxTimeMs, durationMs);
  metrics.prismaOperations[operationName] = operationMetrics;
}

export async function measureDashboardPrismaOperation<T>(
  model: string,
  operation: string,
  query: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await query();
  } finally {
    recordDashboardPrismaOperation(model, operation, performance.now() - startedAt);
  }
}
