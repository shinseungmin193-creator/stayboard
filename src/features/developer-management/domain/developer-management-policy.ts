export type LastAdminResolution = "NONE" | "TRANSFER" | "SUSPEND_COMPANY";

export class DeveloperManagementPolicyError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "SELF_MANAGEMENT"
      | "DEVELOPER_PROTECTED"
      | "LAST_ADMIN"
      | "INVALID_REPLACEMENT"
      | "INVALID_STATE"
      | "SENSITIVE_AUDIT_METADATA",
    message: string,
  ) {
    super(message);
    this.name = "DeveloperManagementPolicyError";
  }
}

export function assertMutableUserTarget(input: {
  actorUserId: string;
  targetUserId: string;
  targetSystemRole: "NONE" | "DEVELOPER";
}) {
  if (input.actorUserId === input.targetUserId) {
    throw new DeveloperManagementPolicyError("SELF_MANAGEMENT", "자기 자신의 계정은 이 작업으로 변경할 수 없습니다.");
  }
  if (input.targetSystemRole === "DEVELOPER") {
    throw new DeveloperManagementPolicyError("DEVELOPER_PROTECTED", "DEVELOPER 계정은 일반 관리 작업으로 변경할 수 없습니다.");
  }
}

export function assertLastAdminResolution(input: {
  lastAdminCompanyIds: readonly string[];
  resolution: LastAdminResolution;
  replacementUserId?: string | null;
}) {
  if (!input.lastAdminCompanyIds.length) return;
  if (input.resolution === "TRANSFER" && input.replacementUserId) return;
  if (input.resolution === "SUSPEND_COMPANY") return;
  throw new DeveloperManagementPolicyError(
    "LAST_ADMIN",
    "마지막 관리자를 처리하려면 새 관리자를 지정하거나 회사를 이용정지해야 합니다.",
  );
}

const SENSITIVE_AUDIT_KEY = /(password|hash|token|cookie|secret|session|email|username)/i;

export function assertSafeAuditMetadata(value: unknown, path = "details") {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_AUDIT_KEY.test(key)) {
      throw new DeveloperManagementPolicyError(
        "SENSITIVE_AUDIT_METADATA",
        `감사 로그에 민감한 필드를 저장할 수 없습니다: ${path}.${key}`,
      );
    }
    assertSafeAuditMetadata(nested, `${path}.${key}`);
  }
}
