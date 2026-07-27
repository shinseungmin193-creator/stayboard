import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
import type { UserRole } from "@/features/access-control/domain/access-control";

export type MemberManagementAction = "MANAGE_INVITATION_CODE" | "CHANGE_ROLE" | "UPDATE_PROPERTY_ACCESS" | "DISABLE_MEMBER" | "REACTIVATE_MEMBER";

export class MemberPolicyError extends Error {
  constructor(message = "해당 사용자를 관리할 권한이 없습니다.") { super(message); this.name = "MemberPolicyError"; }
}

export function assertCanManageMember(input: { actorRole: UserRole; actorUserId: string; targetUserId?: string; targetRole?: CompanyMemberRole; sameCompany: boolean; action: MemberManagementAction }) {
  if (input.actorRole === "STAFF" || !input.sameCompany) throw new MemberPolicyError();
  if (input.targetUserId && input.actorUserId === input.targetUserId) throw new MemberPolicyError("자기 자신의 권한이나 활성 상태는 변경할 수 없습니다.");
  if (input.actorRole === "ADMIN" && input.targetRole && !["ADMIN", "STAFF"].includes(input.targetRole)) throw new MemberPolicyError();
}

export function assertLastActiveAdminSafe(input: { currentRole: CompanyMemberRole; nextRole?: CompanyMemberRole; disabling?: boolean; activeAdminCount: number }) {
  if (input.currentRole === "ADMIN" && (input.disabling || input.nextRole === "STAFF") && input.activeAdminCount <= 1) throw new MemberPolicyError("회사에는 최소 한 명의 관리자가 필요합니다.");
}
