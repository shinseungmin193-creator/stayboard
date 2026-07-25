import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { APP_ERROR_MESSAGES, type AppErrorCode, type AppErrorResponse } from "./app-error";

export interface ClassifiedServerError extends AppErrorResponse { originalMessage: string; stack: string | null; prismaError: string | null; sqlError: string | null }
const connectionCodes = new Set(["P1000", "P1001", "P1002", "P1003", "P1008", "P1010", "P1011", "P1017"]);
const safeOriginal = (error: unknown) => error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000);

function response(errorCode: AppErrorCode, status: number, error: unknown, prismaError: string | null = null): ClassifiedServerError {
  return { status, errorCode, message: APP_ERROR_MESSAGES[errorCode], originalMessage: safeOriginal(error), stack: error instanceof Error ? error.stack?.slice(0, 12000) ?? null : null, prismaError, sqlError: null };
}

export function classifyServerError(error: unknown): ClassifiedServerError {
  const name = error instanceof Error ? error.name : "";
  if (name === "AuthenticationRequiredError") return response("UNAUTHORIZED", 401, error);
  if (name === "AccessDeniedError" || name === "PermissionDeniedError") return response("FORBIDDEN", 403, error);
  if (name === "ResourceNotFoundError") return response("NOT_FOUND", 404, error);
  if (name === "ZodError") return response("VALIDATION_ERROR", 400, error);
  if (name === "CalendarSyncError" || name === "CalendarSyncAlreadyRunningError") return response("SYNC_FAILED", 502, error);
  if (error instanceof Prisma.PrismaClientInitializationError) return response("DATABASE_CONNECTION_FAILED", 503, error, `${error.errorCode ?? "INITIALIZATION"}: ${error.message}`);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (connectionCodes.has(error.code)) return response("DATABASE_CONNECTION_FAILED", 503, error, `${error.code}: ${error.message}`);
    if (error.code === "P2025") return response("NOT_FOUND", 404, error, `${error.code}: ${error.message}`);
    return response("DATABASE_QUERY_FAILED", 500, error, `${error.code}: ${error.message}`);
  }
  if (error instanceof Prisma.PrismaClientValidationError) return response("DATABASE_QUERY_FAILED", 500, error, `PrismaClientValidationError: ${error.message}`);
  if (error instanceof Prisma.PrismaClientUnknownRequestError || error instanceof Prisma.PrismaClientRustPanicError) return response("DATABASE_QUERY_FAILED", 500, error, error.message);
  return response("UNKNOWN_ERROR", 500, error);
}
