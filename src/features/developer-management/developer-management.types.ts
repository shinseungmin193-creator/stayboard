import type { CompanyMemberRole, MembershipStatus, UserStatus, UserSystemRole } from "@/lib/generated/prisma/enums";

export interface DeveloperUserListItem {
  id: string;
  name: string;
  username: string | null;
  email: string;
  systemRole: UserSystemRole;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  companyNames: string[];
  companyRoles: CompanyMemberRole[];
}

export interface DeveloperCompanyListItem {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  adminCount: number;
  staffCount: number;
  propertyCount: number;
  roomCount: number;
}

export interface DeveloperMembershipDetail {
  id: string;
  companyId: string;
  companyName: string;
  companyActive: boolean;
  role: CompanyMemberRole;
  status: MembershipStatus;
  propertyAccessCount: number;
  replacementCandidates: Array<{ id: string; name: string; email: string }>;
}

export interface DeveloperActionState {
  success: boolean;
  messageKey?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string[]>;
}

export const INITIAL_DEVELOPER_ACTION_STATE: DeveloperActionState = { success: false };
