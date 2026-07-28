export type InvitationCodeDisplayStatus = "ACTIVE" | "USED" | "EXPIRED" | "REVOKED";

export function invitationCodeUnavailableReason(
  code: { status: "ACTIVE" | "USED" | "REVOKED"; expiresAt: Date },
  now = new Date(),
) {
  if (code.status === "USED") return "이미 사용된 초대코드입니다.";
  if (code.status === "REVOKED") return "폐기된 초대코드입니다.";
  if (code.expiresAt.getTime() <= now.getTime()) return "만료된 초대코드입니다.";
  return null;
}

export function getInvitationCodeDisplayStatus(
  code: { status: "ACTIVE" | "USED" | "REVOKED"; expiresAt: Date },
  now = new Date(),
): InvitationCodeDisplayStatus {
  if (code.status === "USED") return "USED";
  if (code.status === "REVOKED") return "REVOKED";
  return code.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "ACTIVE";
}
