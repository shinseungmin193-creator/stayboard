import { NextResponse } from "next/server";
import { getCurrentAccessContext } from "@/features/access-control";
import { findErrorLogByDigest, saveErrorLog } from "@/features/error-logs/error-log.repository";
import { APP_ERROR_MESSAGES, UNKNOWN_ERROR_RESPONSE, isAppErrorCode, type DeveloperErrorDetails } from "@/lib/app-error";
import { classifyServerError } from "@/lib/server-error";

export async function POST(request: Request) {
  let payload: { digest?: string; message?: string; stack?: string; apiRoute?: string } = {};
  try { payload = await request.json(); } catch { return NextResponse.json({ status: 400, errorCode: "VALIDATION_ERROR", message: APP_ERROR_MESSAGES.VALIDATION_ERROR }, { status: 400 }); }
  const existing = payload.digest ? await findErrorLogByDigest(payload.digest).catch(() => null) : null;
  const existingCode = existing && isAppErrorCode(existing.errorCode) ? existing.errorCode : "UNKNOWN_ERROR";
  const classified = existing ? { status: existing.status, errorCode: existingCode, message: APP_ERROR_MESSAGES[existingCode], originalMessage: existing.message, stack: existing.stack, prismaError: existing.prismaError, sqlError: existing.sqlError } : classifyServerError(new Error(payload.message || "Client route error"));
  if (!existing) await saveErrorLog({ ...classified, digest: payload.digest, apiRoute: payload.apiRoute, routeType: "client-boundary", stack: payload.stack?.slice(0, 12000) ?? classified.stack });
  let isDeveloper = false;
  try { isDeveloper = (await getCurrentAccessContext())?.role === "DEVELOPER"; } catch { /* 오류 표시 경로에서 인증 조회 실패는 숨긴다. */ }
  const details: DeveloperErrorDetails | undefined = isDeveloper ? { errorCode: classified.errorCode as DeveloperErrorDetails["errorCode"], stack: classified.stack, apiRoute: existing?.apiRoute ?? payload.apiRoute ?? null, prismaError: classified.prismaError, sqlError: classified.sqlError, originalMessage: classified.originalMessage } : undefined;
  return NextResponse.json({ status: classified.status, errorCode: classified.errorCode, message: classified.message, details });
}

export function GET() { return NextResponse.json(UNKNOWN_ERROR_RESPONSE, { status: 405 }); }
