import type { UserRole } from "@/features/access-control/domain/access-control";

export function canCreateUserRole(actorRole: UserRole, targetRole: UserRole) {
  if (targetRole === "DEVELOPER") return false;
  return actorRole === "DEVELOPER" || (actorRole === "ADMIN" && targetRole === "STAFF");
}

export function canManageTarget(input: { actorRole: UserRole; actorUserId: string; targetUserId: string; targetRole: UserRole; sameCompany: boolean }) {
  if (input.actorUserId === input.targetUserId) return false;
  if (input.actorRole === "DEVELOPER") return true;
  return input.actorRole === "ADMIN" && input.sameCompany && input.targetRole === "STAFF";
}

export function canAssignRole(actorRole: UserRole, targetRole: UserRole) {
  if (targetRole === "DEVELOPER") return false;
  return actorRole === "DEVELOPER" || (actorRole === "ADMIN" && targetRole === "STAFF");
}

export function canDeactivateAccount(input: { isSelf: boolean; targetRole: UserRole; activeDeveloperCount: number }) {
  if (input.isSelf) return false;
  return input.targetRole !== "DEVELOPER" || input.activeDeveloperCount > 1;
}

export function canChangeAccountRole(input: { isSelf: boolean; currentRole: UserRole; nextRole: UserRole; activeDeveloperCount: number }) {
  if (input.isSelf) return false;
  return input.currentRole !== "DEVELOPER" || input.nextRole === "DEVELOPER" || input.activeDeveloperCount > 1;
}
