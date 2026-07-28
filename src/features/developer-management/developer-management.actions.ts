"use server";

import { revalidatePath } from "next/cache";
import {
  anonymizeUserSchema,
  changeUserRoleSchema,
  companyStatusSchema,
  deleteUserSchema,
  forceLogoutUserSchema,
  restoreUserSchema,
  suspendUserSchema,
  transferCompanyAdminSchema,
} from "./developer-management.schemas";
import type { DeveloperActionState } from "./developer-management.types";
import { getDeveloperMutationAccess } from "./server/developer-access";
import {
  anonymizeDeletedUser,
  changeUserRole,
  forceLogoutUser,
  restoreCompany,
  restoreUser,
  softDeleteUser,
  suspendCompany,
  suspendUser,
  transferCompanyAdmin,
} from "./developer-management.service";
import { DeveloperManagementPolicyError } from "./domain/developer-management-policy";

const forbidden = (): DeveloperActionState => ({
  success: false,
  errorCode: "FORBIDDEN",
  messageKey: "developerManagement.messages.forbidden",
});

function failed(error: unknown): DeveloperActionState {
  if (error instanceof DeveloperManagementPolicyError) {
    const policyKeys: Record<string, string> = {
      SELF_MANAGEMENT: "developerManagement.messages.selfManagement",
      DEVELOPER_PROTECTED: "developerManagement.messages.developerProtected",
      LAST_ADMIN: "developerManagement.messages.lastAdmin",
      INVALID_REPLACEMENT: "developerManagement.messages.invalidReplacement",
      INVALID_STATE: "developerManagement.messages.invalidState",
      SENSITIVE_AUDIT_METADATA: "developerManagement.messages.failed",
      FORBIDDEN: "developerManagement.messages.forbidden",
    };
    return { success: false, errorCode: error.code, messageKey: policyKeys[error.code] };
  }
  return { success: false, errorCode: "INTERNAL_ERROR", messageKey: "developerManagement.messages.failed" };
}

function invalid(): DeveloperActionState {
  return { success: false, errorCode: "INVALID_INPUT", messageKey: "developerManagement.messages.invalidInput" };
}

function refreshUser(userId: string) {
  revalidatePath("/developer/users");
  revalidatePath(`/developer/users/${userId}`);
  revalidatePath("/developer/companies");
  revalidatePath("/developer/audit-logs");
}

function refreshCompany(companyId: string) {
  revalidatePath("/developer/companies");
  revalidatePath(`/developer/companies/${companyId}`);
  revalidatePath("/developer/users");
  revalidatePath("/developer/audit-logs");
}

export async function suspendUserAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = suspendUserSchema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
    lastAdminResolution: formData.get("lastAdminResolution") ?? "NONE",
    replacementUserId: formData.get("replacementUserId") || undefined,
  });
  if (!parsed.success) return invalid();
  try {
    await suspendUser({ actorUserId: context.userId, ...parsed.data });
    refreshUser(parsed.data.userId);
    return { success: true, messageKey: "developerManagement.messages.userSuspended" };
  } catch (error) { return failed(error); }
}

export async function restoreUserAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = restoreUserSchema.safeParse({ userId: formData.get("userId"), reason: formData.get("reason") ?? "" });
  if (!parsed.success) return invalid();
  try {
    await restoreUser({ actorUserId: context.userId, ...parsed.data });
    refreshUser(parsed.data.userId);
    return { success: true, messageKey: "developerManagement.messages.userRestored" };
  } catch (error) { return failed(error); }
}

export async function forceLogoutUserAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = forceLogoutUserSchema.safeParse({ userId: formData.get("userId"), reason: formData.get("reason") });
  if (!parsed.success) return invalid();
  try {
    await forceLogoutUser({ actorUserId: context.userId, ...parsed.data });
    refreshUser(parsed.data.userId);
    return { success: true, messageKey: "developerManagement.messages.userLoggedOut" };
  } catch (error) { return failed(error); }
}

export async function softDeleteUserAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = deleteUserSchema.safeParse({
    userId: formData.get("userId"),
    confirmation: formData.get("confirmation"),
    reason: formData.get("reason"),
    lastAdminResolution: formData.get("lastAdminResolution") ?? "NONE",
    replacementUserId: formData.get("replacementUserId") || undefined,
  });
  if (!parsed.success) return invalid();
  try {
    await softDeleteUser({ actorUserId: context.userId, ...parsed.data });
    refreshUser(parsed.data.userId);
    return { success: true, messageKey: "developerManagement.messages.userDeleted" };
  } catch (error) { return failed(error); }
}

export async function anonymizeDeletedUserAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = anonymizeUserSchema.safeParse({ userId: formData.get("userId"), confirmation: formData.get("confirmation"), reason: formData.get("reason") });
  if (!parsed.success) return invalid();
  try {
    await anonymizeDeletedUser({ actorUserId: context.userId, ...parsed.data });
    refreshUser(parsed.data.userId);
    return { success: true, messageKey: "developerManagement.messages.userAnonymized" };
  } catch (error) { return failed(error); }
}

export async function changeUserRoleAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = changeUserRoleSchema.safeParse({
    userId: formData.get("userId"),
    companyId: formData.get("companyId"),
    role: formData.get("role"),
    reason: formData.get("reason"),
    lastAdminResolution: formData.get("lastAdminResolution") ?? "NONE",
    replacementUserId: formData.get("replacementUserId") || undefined,
  });
  if (!parsed.success) return invalid();
  try {
    await changeUserRole({ actorUserId: context.userId, ...parsed.data });
    refreshUser(parsed.data.userId);
    refreshCompany(parsed.data.companyId);
    return { success: true, messageKey: "developerManagement.messages.roleChanged" };
  } catch (error) { return failed(error); }
}

export async function suspendCompanyAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = companyStatusSchema.safeParse({ companyId: formData.get("companyId"), reason: formData.get("reason") });
  if (!parsed.success) return invalid();
  try {
    await suspendCompany({ actorUserId: context.userId, ...parsed.data });
    refreshCompany(parsed.data.companyId);
    return { success: true, messageKey: "developerManagement.messages.companySuspended" };
  } catch (error) { return failed(error); }
}

export async function restoreCompanyAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = companyStatusSchema.safeParse({ companyId: formData.get("companyId"), reason: formData.get("reason") });
  if (!parsed.success) return invalid();
  try {
    await restoreCompany({ actorUserId: context.userId, ...parsed.data });
    refreshCompany(parsed.data.companyId);
    return { success: true, messageKey: "developerManagement.messages.companyRestored" };
  } catch (error) { return failed(error); }
}

export async function transferCompanyAdminAction(_state: DeveloperActionState, formData: FormData): Promise<DeveloperActionState> {
  const context = await getDeveloperMutationAccess();
  if (!context) return forbidden();
  const parsed = transferCompanyAdminSchema.safeParse({ companyId: formData.get("companyId"), replacementUserId: formData.get("replacementUserId"), reason: formData.get("reason") });
  if (!parsed.success) return invalid();
  try {
    await transferCompanyAdmin({ actorUserId: context.userId, ...parsed.data });
    refreshCompany(parsed.data.companyId);
    return { success: true, messageKey: "developerManagement.messages.adminTransferred" };
  } catch (error) { return failed(error); }
}
