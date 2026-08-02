export { AccessDeniedError, AuthenticationRequiredError, authorizeAccess, FORBIDDEN_ACTION_RESULT, getCurrentAccessContext, isAccessControlError, PermissionDeniedError, requireAuth, requireCalendarSourceAccess, requireCompanyAccess, requirePermission, requirePropertyAccess, requireRole, requireRoomAccess, ResourceNotFoundError } from "./application/access-context";
export { AccessDenied } from "./components/access-denied";
export { canAccessCompany, canAccessProperty, canAccessRoom, companyScopeIds, hasPermission, isUserRole, PERMISSIONS, ROLE_PERMISSIONS, USER_ROLE_LABELS, USER_ROLES, withAccessAuditMetadata } from "./domain/access-control";
export type { AccessContext, AccessScope, Permission, UserRole } from "./domain/access-control";
export { propertyScopeWhere, roomScopeWhere } from "./infrastructure/prisma-scope";
