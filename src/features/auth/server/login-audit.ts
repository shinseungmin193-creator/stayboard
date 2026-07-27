import "server-only";

import type { LoginRejectionReason } from "../domain/authenticate-login";

type LoginAuditReason = LoginRejectionReason | "INVALID_INPUT" | "AUTHENTICATION_ERROR";

export function logLoginRejection(reason: LoginAuditReason, error?: unknown) {
  console.warn(JSON.stringify({
    level: "warn",
    event: "AUTH_LOGIN_REJECTED",
    reason,
    errorName: error instanceof Error ? error.name : undefined,
    timestamp: new Date().toISOString(),
  }));
}
