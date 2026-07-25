import "server-only";
import { prisma } from "@/lib/prisma";
import type { ClassifiedServerError } from "@/lib/server-error";

export async function saveErrorLog(input: ClassifiedServerError & { digest?: string | null; apiRoute?: string | null; routeType?: string | null }) {
  try { return await prisma.errorLog.create({ data: { digest: input.digest, status: input.status, errorCode: input.errorCode, message: input.originalMessage, stack: input.stack, apiRoute: input.apiRoute, routeType: input.routeType, prismaError: input.prismaError, sqlError: input.sqlError }, select: { id: true } }); }
  catch (loggingError) { console.error("[ErrorLog] 오류 로그를 DB에 저장하지 못했습니다.", loggingError); return null; }
}

export function findErrorLogByDigest(digest: string) { return prisma.errorLog.findFirst({ where: { digest }, orderBy: { createdAt: "desc" } }); }
export function listRecentErrorLogs(take = 100) { return prisma.errorLog.findMany({ orderBy: { createdAt: "desc" }, take }); }
