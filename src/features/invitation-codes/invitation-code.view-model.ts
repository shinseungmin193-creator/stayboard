import { INVITATION_CODE_MASK } from "./invitation-code.constants";

export function maskInvitationCodePrefix(codePrefix: string) {
  return `${codePrefix}-${INVITATION_CODE_MASK}`;
}
