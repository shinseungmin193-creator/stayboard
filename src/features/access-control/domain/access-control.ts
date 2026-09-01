export const USER_ROLES = ["DEVELOPER", "ADMIN", "STAFF"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS = {
  DEVELOPER: "개발자",
  ADMIN: "관리자",
  STAFF: "직원",
} as const satisfies Record<UserRole, string>;

export const PERMISSIONS = {
  COMPANY_READ: "company.read",
  COMPANY_MANAGE: "company.manage",
  PROPERTY_READ: "property.read",
  PROPERTY_MANAGE: "property.manage",
  ROOM_READ: "room.read",
  ROOM_MANAGE: "room.manage",
  ROOM_OPERATIONAL_STATUS_UPDATE: "room.operational-status.update",
  ROOM_NOTE_READ: "room-note.read",
  ROOM_NOTE_CREATE: "room-note.create",
  ROOM_NOTE_COMPLETE: "room-note.complete",
  ROOM_NOTE_DELETE: "room-note.delete",
  RESERVATION_READ: "reservation.read",
  CLEANING_READ: "cleaning.read",
  CLEANING_MANAGE: "cleaning.manage",
  CLEANING_ASSIGN: "cleaning.assign",
  CLEANING_WORKER_READ: "cleaning-worker.read",
  CLEANING_WORKER_CREATE: "cleaning-worker.create",
  CLEANING_WORKER_MANAGE: "cleaning-worker.manage",
  CALENDAR_SOURCE_READ: "calendar-source.read",
  CALENDAR_SOURCE_MANAGE: "calendar-source.manage",
  SYNC_READ: "sync.read",
  SYNC_RUN: "sync.run",
  STATISTICS_READ: "statistics.read",
  PROPERTY_REVIEW_READ: "property-review.read",
  PROPERTY_REVIEW_SYNC: "property-review.sync",
  ADMIN_SETTINGS_READ: "admin-settings.read",
  ADMIN_SETTINGS_MANAGE: "admin-settings.manage",
  DEVELOPER_SETTINGS_READ: "developer-settings.read",
  DEVELOPER_SETTINGS_MANAGE: "developer-settings.manage",
  DEVELOPER_MANAGEMENT_READ: "developer-management.read",
  DEVELOPER_MANAGEMENT_MANAGE: "developer-management.manage",
  USER_MANAGE: "user.manage",
  DEBUG_READ: "debug.read",
  FEATURE_FLAGS_MANAGE: "feature-flags.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSIONS = {
  DEVELOPER: ALL_PERMISSIONS,
  ADMIN: [
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.PROPERTY_READ,
    PERMISSIONS.PROPERTY_MANAGE,
    PERMISSIONS.ROOM_READ,
    PERMISSIONS.ROOM_MANAGE,
    PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE,
    PERMISSIONS.ROOM_NOTE_READ,
    PERMISSIONS.ROOM_NOTE_CREATE,
    PERMISSIONS.ROOM_NOTE_COMPLETE,
    PERMISSIONS.ROOM_NOTE_DELETE,
    PERMISSIONS.RESERVATION_READ,
    PERMISSIONS.CLEANING_READ,
    PERMISSIONS.CLEANING_MANAGE,
    PERMISSIONS.CLEANING_ASSIGN,
    PERMISSIONS.CLEANING_WORKER_READ,
    PERMISSIONS.CLEANING_WORKER_CREATE,
    PERMISSIONS.CLEANING_WORKER_MANAGE,
    PERMISSIONS.CALENDAR_SOURCE_READ,
    PERMISSIONS.CALENDAR_SOURCE_MANAGE,
    PERMISSIONS.SYNC_READ,
    PERMISSIONS.SYNC_RUN,
    PERMISSIONS.STATISTICS_READ,
    PERMISSIONS.PROPERTY_REVIEW_READ,
    PERMISSIONS.PROPERTY_REVIEW_SYNC,
    PERMISSIONS.ADMIN_SETTINGS_READ,
    PERMISSIONS.ADMIN_SETTINGS_MANAGE,
    PERMISSIONS.USER_MANAGE,
  ],
  STAFF: [
    PERMISSIONS.PROPERTY_READ,
    PERMISSIONS.ROOM_READ,
    PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE,
    PERMISSIONS.ROOM_NOTE_READ,
    PERMISSIONS.ROOM_NOTE_CREATE,
    PERMISSIONS.ROOM_NOTE_COMPLETE,
    PERMISSIONS.RESERVATION_READ,
    PERMISSIONS.CLEANING_READ,
    PERMISSIONS.CLEANING_MANAGE,
    PERMISSIONS.CLEANING_WORKER_READ,
    PERMISSIONS.CLEANING_WORKER_CREATE,
    PERMISSIONS.SYNC_RUN,
    PERMISSIONS.STATISTICS_READ,
  ],
} as const satisfies Record<UserRole, readonly Permission[]>;

export type AccessScope =
  | { mode: "all" }
  | {
      mode: "companies";
      companyIds: readonly string[];
      propertyIds?: readonly string[];
      roomIds?: readonly string[];
    };

export interface AccessContext {
  userId: string;
  email?: string;
  name?: string;
  actualRole: UserRole;
  previewRole: UserRole | null;
  effectiveRole: UserRole;
  isRoleSwitchActive: boolean;
  /** @deprecated 권한 호환 필드이며 effectiveRole과 항상 같습니다. */
  role: UserRole;
  systemRole: "DEVELOPER" | "NONE";
  companyRole: "ADMIN" | "STAFF" | null;
  activeCompanyId?: string | null;
  activeCompanyName?: string | null;
  availableCompanies?: readonly { id: string; name: string }[];
  allowedCompanyIds: readonly string[] | null;
  allowedPropertyIds: readonly string[] | null;
  developerRoleSessionId: string | null;
  roleSwitchExpiresAt?: string | null;
  roleSwitchPropertyScopeMode?: "ALL" | "SELECTED" | null;
  roleSwitchSelectedPropertyIds?: readonly string[];
  roleSwitchCookieStatus?: "NONE" | "STALE" | "ACTIVE";
  scope: AccessScope;
  source: "session" | "development-bootstrap";
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function hasPermission(role: UserRole | null | undefined, permission: Permission) {
  return role ? ROLE_PERMISSIONS[role].includes(permission as never) : false;
}

export function canAccessCompany(context: AccessContext, companyId: string) {
  return context.scope.mode === "all" || context.scope.companyIds.includes(companyId);
}

export function companyScopeIds(context: AccessContext): readonly string[] | undefined {
  return context.scope.mode === "all" ? undefined : context.scope.companyIds;
}

export function canAccessProperty(context: AccessContext, propertyId: string) {
  if (context.scope.mode === "all") return true;
  return context.scope.propertyIds === undefined || context.scope.propertyIds.includes(propertyId);
}

export function canAccessRoom(context: AccessContext, room: { id: string; propertyId: string }) {
  if (context.scope.mode === "all") return true;
  if (context.scope.propertyIds === undefined && context.scope.roomIds === undefined) return true;
  return Boolean(context.scope.propertyIds?.includes(room.propertyId) || context.scope.roomIds?.includes(room.id));
}

export function withAccessAuditMetadata<T extends Record<string, unknown>>(context: AccessContext, details: T): T & {
  actualRole?: UserRole;
  effectiveRole?: UserRole;
  developerRoleSessionId?: string;
} {
  if (!context.isRoleSwitchActive || !context.developerRoleSessionId) return details;
  return {
    ...details,
    actualRole: context.actualRole,
    effectiveRole: context.effectiveRole,
    developerRoleSessionId: context.developerRoleSessionId,
  };
}
