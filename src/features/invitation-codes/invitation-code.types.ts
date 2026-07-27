import type { listInvitationCodes } from "./invitation-code.repository";
export type InvitationCodeListItem = Awaited<ReturnType<typeof listInvitationCodes>>[number];
