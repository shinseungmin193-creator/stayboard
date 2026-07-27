import { isUserRole, type UserRole } from "./access-control";

export const ROLE_PREVIEW_COOKIE_NAME = "stayboard_dev_preview_role";
export const ROLE_PREVIEW_MAX_AGE_SECONDS = 60 * 60 * 2;
export const ROLE_PREVIEW_WRITE_BLOCKED_MESSAGE = "권한 미리보기 중에는 이 작업을 실행할 수 없습니다.";

export interface RolePreviewEnvironment {
  NODE_ENV?: string;
  ENABLE_ROLE_PREVIEW?: string;
}

export interface AuthorizationRoles {
  actualRole: UserRole;
  previewRole: UserRole | null;
  effectiveRole: UserRole;
}

export function getActualRole(actualRole: UserRole): UserRole {
  return actualRole;
}

export function canUseRolePreview(environment: RolePreviewEnvironment, actualRole: UserRole) {
  return environment.NODE_ENV !== "production"
    && environment.ENABLE_ROLE_PREVIEW === "true"
    && actualRole === "DEVELOPER";
}

export function getPreviewRole(
  environment: RolePreviewEnvironment,
  actualRole: UserRole,
  cookieValue: unknown,
  hasActiveCompany: boolean,
): UserRole | null {
  if (!canUseRolePreview(environment, actualRole) || !isUserRole(cookieValue) || cookieValue === "DEVELOPER") return null;
  return hasActiveCompany ? cookieValue : null;
}

export function getEffectiveRole(actualRole: UserRole, previewRole: UserRole | null): UserRole {
  return actualRole === "DEVELOPER" && previewRole ? previewRole : actualRole;
}

export function getAuthorizationRoles(
  environment: RolePreviewEnvironment,
  actualRole: UserRole,
  cookieValue: unknown,
  hasActiveCompany: boolean,
): AuthorizationRoles {
  const resolvedActualRole = getActualRole(actualRole);
  const previewRole = getPreviewRole(environment, resolvedActualRole, cookieValue, hasActiveCompany);
  return { actualRole: resolvedActualRole, previewRole, effectiveRole: getEffectiveRole(resolvedActualRole, previewRole) };
}

export function isRolePreviewActive(context: Pick<AuthorizationRoles, "actualRole" | "previewRole" | "effectiveRole">) {
  return context.actualRole === "DEVELOPER"
    && context.previewRole !== null
    && context.effectiveRole !== context.actualRole;
}
