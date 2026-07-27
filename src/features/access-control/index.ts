export { AccessDeniedError, AuthenticationRequiredError, authorizeAccess, FORBIDDEN_ACTION_RESULT, getCurrentAccessContext, getRolePreviewWriteBlock, isAccessControlError, PermissionDeniedError, requireAuth, requireCalendarSourceAccess, requireCompanyAccess, requirePermission, requirePropertyAccess, requireRole, requireRoomAccess, ResourceNotFoundError, ROLE_PREVIEW_WRITE_BLOCKED_RESULT } from "./application/access-context";
export { AccessDenied } from "./components/access-denied";
export { canAccessCompany, canAccessProperty, canAccessRoom, companyScopeIds, hasPermission, isUserRole, PERMISSIONS, ROLE_PERMISSIONS, USER_ROLE_LABELS, USER_ROLES } from "./domain/access-control";
export type { AccessContext, AccessScope, Permission, UserRole } from "./domain/access-control";
export { canUseRolePreview, getActualRole, getAuthorizationRoles, getEffectiveRole, getPreviewRole, isRolePreviewActive, ROLE_PREVIEW_COOKIE_NAME, ROLE_PREVIEW_MAX_AGE_SECONDS, ROLE_PREVIEW_WRITE_BLOCKED_MESSAGE } from "./domain/role-preview";
export type { AuthorizationRoles, RolePreviewEnvironment } from "./domain/role-preview";
export { propertyScopeWhere, roomScopeWhere } from "./infrastructure/prisma-scope";
