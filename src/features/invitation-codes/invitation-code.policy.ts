export function invitationCodeUnavailableReason(code: { status: "ACTIVE" | "USED" | "REVOKED" }) {
  if (code.status === "USED") return "이미 사용된 초대코드입니다.";
  if (code.status === "REVOKED") return "폐기된 초대코드입니다.";
  return null;
}
