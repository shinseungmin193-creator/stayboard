import { Prisma } from "@/lib/generated/prisma/client";
import type { ActionResult } from "./action-result";
import { classifyServerError } from "./server-error";
import { saveErrorLog } from "@/features/error-logs/error-log.repository";

export function isPrismaUniqueError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function logServerError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "development") console.error(`[${context}]`, error);
}

export async function actionFailureFromError(error: unknown, context: string): Promise<Extract<ActionResult, { success: false }>> {
  logServerError(context, error);
  const classified = classifyServerError(error);
  await saveErrorLog({ ...classified, apiRoute: context, routeType: "action" });
  return { success: false, status: classified.status, errorCode: classified.errorCode, message: classified.message };
}
