import { createHash, randomBytes } from "node:crypto";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";
import { INVITATION_CODE_MASK, INVITATION_CODE_RANDOM_BYTES } from "./invitation-code.constants";

export function normalizeInvitationCode(code: string) { return code.trim().toUpperCase(); }
export function hashInvitationCode(code: string) { return createHash("sha256").update(normalizeInvitationCode(code)).digest("hex"); }
export function generateInvitationCode(role: CompanyMemberRole) {
  const random = randomBytes(INVITATION_CODE_RANDOM_BYTES).toString("hex").toUpperCase();
  const groups = random.match(/.{1,5}/g) ?? [random];
  const code = `SB-${role}-${groups.join("-")}`;
  return { code, codeHash: hashInvitationCode(code), codePrefix: `SB-${role}-${groups[0]}` };
}
export function maskInvitationCode(codePrefix: string) { return `${codePrefix}-${INVITATION_CODE_MASK}`; }

export function invitationCodeUnavailableReason(code: { isActive: boolean; expiresAt: Date | null; maxUses: number | null; usedCount: number }, now = new Date()) {
  if (!code.isActive) return "비활성화된 초대코드입니다.";
  if (code.expiresAt && code.expiresAt <= now) return "만료된 초대코드입니다.";
  if (code.maxUses !== null && code.usedCount >= code.maxUses) return "사용 가능한 횟수를 모두 사용한 초대코드입니다.";
  return null;
}
