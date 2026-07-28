import "server-only";

import {
  getCurrentAccessContext,
  getRolePreviewWriteBlock,
  hasPermission,
  PERMISSIONS,
} from "@/features/access-control";

export async function getDeveloperAccess() {
  const context = await getCurrentAccessContext();
  if (
    !context ||
    context.systemRole !== "DEVELOPER" ||
    context.actualRole !== "DEVELOPER" ||
    !hasPermission("DEVELOPER", PERMISSIONS.DEVELOPER_MANAGEMENT_READ)
  ) return null;
  return context;
}

export async function getDeveloperMutationAccess() {
  const context = await getDeveloperAccess();
  if (!context || getRolePreviewWriteBlock(context)) return null;
  if (!hasPermission("DEVELOPER", PERMISSIONS.DEVELOPER_MANAGEMENT_MANAGE)) return null;
  return context;
}
