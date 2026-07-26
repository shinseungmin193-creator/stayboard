import type { listCompanyMembers } from "./member-management.repository";
export type AwaitedReturn = Awaited<ReturnType<typeof listCompanyMembers>>;
type MemberRow = Extract<AwaitedReturn["rows"][number], { kind: "MEMBER" }>;
type InvitationRow = Extract<AwaitedReturn["rows"][number], { kind: "INVITATION" }>;
export type ManagedMembership = MemberRow["membership"];
export type PendingInvitation = InvitationRow["invitation"];
