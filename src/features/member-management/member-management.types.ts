import type { listCompanyMembers } from "./member-management.repository";
export type AwaitedReturn = Awaited<ReturnType<typeof listCompanyMembers>>;
type MemberRow = Extract<AwaitedReturn["rows"][number], { kind: "MEMBER" }>;
export type ManagedMembership = MemberRow["membership"];
