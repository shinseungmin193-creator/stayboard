import type { CompanyMemberRole, InvitationCodeStatus } from "@/lib/generated/prisma/enums";

export interface InvitationCodeViewModel {
  id: string;
  role: CompanyMemberRole;
  codePrefix: string;
  status: InvitationCodeStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export type InvitationCodeListItem = InvitationCodeViewModel;
