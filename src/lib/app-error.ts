export const APP_ERROR_CODES = ["DATABASE_CONNECTION_FAILED", "DATABASE_QUERY_FAILED", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "VALIDATION_ERROR", "SYNC_FAILED", "UNKNOWN_ERROR"] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export const APP_ERROR_MESSAGES: Record<AppErrorCode, string> = {
  DATABASE_CONNECTION_FAILED: "데이터베이스에 연결할 수 없습니다.",
  DATABASE_QUERY_FAILED: "데이터를 조회하는 중 오류가 발생했습니다.",
  UNAUTHORIZED: "로그인이 필요합니다.",
  FORBIDDEN: "접근 권한이 없습니다.",
  NOT_FOUND: "요청한 데이터를 찾을 수 없습니다.",
  VALIDATION_ERROR: "입력값을 확인하세요.",
  SYNC_FAILED: "동기화 중 오류가 발생했습니다.",
  UNKNOWN_ERROR: "알 수 없는 오류가 발생했습니다.",
};

export interface AppErrorResponse { status: number; errorCode: AppErrorCode; message: string }
export interface DeveloperErrorDetails { errorCode: AppErrorCode; stack: string | null; apiRoute: string | null; prismaError: string | null; sqlError: string | null; originalMessage: string }
export const UNKNOWN_ERROR_RESPONSE: AppErrorResponse = { status: 500, errorCode: "UNKNOWN_ERROR", message: APP_ERROR_MESSAGES.UNKNOWN_ERROR };

export function isAppErrorCode(value: unknown): value is AppErrorCode { return typeof value === "string" && APP_ERROR_CODES.includes(value as AppErrorCode); }
