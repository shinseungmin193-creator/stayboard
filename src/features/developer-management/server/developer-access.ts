import "server-only";

import {
  getCurrentAccessContext,
  hasPermission,
  PERMISSIONS,
} from "@/features/access-control";

export async function getDeveloperAccess() {
  const context = await getCurrentAccessContext();
  if (
    !context ||
    context.systemRole !== "DEVELOPER" ||
    context.actualRole !== "DEVELOPER" ||
    context.isRoleSwitchActive ||
    !hasPermission(context.effectiveRole, PERMISSIONS.DEVELOPER_MANAGEMENT_READ)
  ) return null;
  return context;
}

export async function getDeveloperMutationAccess() {
  const context = await getDeveloperAccess();
  if (!context) return null;
  if (!hasPermission(context.effectiveRole, PERMISSIONS.DEVELOPER_MANAGEMENT_MANAGE)) return null;
  return context;
}
