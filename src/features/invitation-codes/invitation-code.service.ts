import { createHash, randomBytes } from "node:crypto";
import { INVITATION_CODE_MASK, INVITATION_CODE_RANDOM_BYTES } from "./invitation-code.constants";

export function normalizeInvitationCode(code: string) { return code.trim().toUpperCase(); }
export function hashInvitationCode(code: string) { return createHash("sha256").update(normalizeInvitationCode(code)).digest("hex"); }
export function generateInvitationCode() {
  const random = randomBytes(INVITATION_CODE_RANDOM_BYTES).toString("hex").toUpperCase();
  const groups = random.match(/.{1,5}/g) ?? [random];
  const code = `SB-ADMIN-${groups.join("-")}`;
  return { code, codeHash: hashInvitationCode(code), codePrefix: `SB-ADMIN-${groups[0]}` };
}
export function maskInvitationCode(codePrefix: string) { return `${codePrefix}-${INVITATION_CODE_MASK}`; }
export function invitationCodeUnavailableReason(code: { status: "ACTIVE" | "USED" | "REVOKED" }) {
  if (code.status === "USED") return "이미 사용된 초대코드입니다.";
  if (code.status === "REVOKED") return "폐기된 초대코드입니다.";
  return null;
}
