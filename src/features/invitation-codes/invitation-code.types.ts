import type { InvitationCodeStatus } from "@/lib/generated/prisma/enums";

export interface InvitationCodeViewModel {
  id: string;
  codePrefix: string;
  status: InvitationCodeStatus;
  createdAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
}

export type InvitationCodeListItem = InvitationCodeViewModel;
