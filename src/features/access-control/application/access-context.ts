import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/features/auth/server/get-current-user";
import type { AccessContext, Permission } from "../domain/access-control";
import { canAccessCompany, canAccessProperty, canAccessRoom, hasPermission } from "../domain/access-control";
import { getAuthorizationRoles, isRolePreviewActive, ROLE_PREVIEW_COOKIE_NAME, ROLE_PREVIEW_WRITE_BLOCKED_MESSAGE } from "../domain/role-preview";

export interface AccessContextProvider {
  getCurrentAccessContext(): Promise<AccessContext | null>;
}

const ACTIVE_COMPANY_COOKIE = "stayboard.active-company";

const accessContextProvider: AccessContextProvider = {
  async getCurrentAccessContext() {
    const user = await getCurrentUser();
    if (!user?.isActive) return null;
    const cookieStore = await cookies();
    const requestedCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
    if (user.systemRole === "DEVELOPER") {
      const companies = await prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
      const activeCompany = companies.find((company) => company.id === requestedCompanyId);
      const roles = getAuthorizationRoles(process.env, "DEVELOPER", cookieStore.get(ROLE_PREVIEW_COOKIE_NAME)?.value, Boolean(activeCompany));
      const staffPropertyIds = roles.effectiveRole === "STAFF" && activeCompany
        ? (await prisma.property.findMany({ where: { companyId: activeCompany.id, isActive: true }, select: { id: true } })).map((property) => property.id)
        : undefined;
      const scope = activeCompany
        ? { mode: "companies" as const, companyIds: [activeCompany.id], ...(roles.effectiveRole === "STAFF" ? { propertyIds: staffPropertyIds ?? [] } : {}) }
        : { mode: "all" as const };
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        ...roles,
        role: roles.effectiveRole,
        systemRole: "DEVELOPER",
        companyRole: roles.previewRole === "ADMIN" || roles.previewRole === "STAFF" ? roles.previewRole : null,
        activeCompanyId: activeCompany?.id ?? null,
        activeCompanyName: activeCompany?.name ?? null,
        availableCompanies: companies,
        previewScopeLabel: roles.effectiveRole === "STAFF" ? "테스트 범위: 현재 회사의 활성 숙소 전체" : null,
        scope,
        source: "session",
      };
    }

    const membership = user.memberships.find((item) => item.companyId === requestedCompanyId) ?? user.memberships[0];
    if (!membership) return null;
    const membershipPropertyIds = membership.propertyAccesses.map((item) => item.propertyId);
    const propertyIds = membershipPropertyIds.length ? membershipPropertyIds : user.assignments.flatMap((item) => item.propertyId && item.property?.companyId === membership.companyId ? [item.propertyId] : []);
    const roomIds = user.assignments.flatMap((item) => item.roomId && item.room?.property.companyId === membership.companyId ? [item.roomId] : []);
    const roles = getAuthorizationRoles(process.env, membership.role, null, true);
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      ...roles,
      role: roles.effectiveRole,
      systemRole: "NONE",
      companyRole: membership.role,
      activeCompanyId: membership.companyId,
      activeCompanyName: membership.company.name,
      availableCompanies: user.memberships.map((item) => ({ id: item.companyId, name: item.company.name })),
      scope: membership.role === "STAFF"
        ? { mode: "companies", companyIds: [membership.companyId], propertyIds, roomIds }
        : { mode: "companies", companyIds: [membership.companyId] },
      source: "session",
    };
  },
};

export const getCurrentAccessContext = cache(() => accessContextProvider.getCurrentAccessContext());

export type AccessDecision =
  | { allowed: true; context: AccessContext }
  | { allowed: false; context: AccessContext | null; reason: "UNAUTHENTICATED" | "FORBIDDEN" | "COMPANY_SCOPE" };

export async function authorizeAccess(permission: Permission, companyId?: string): Promise<AccessDecision> {
  const context = await getCurrentAccessContext();
  if (!context) return { allowed: false, context: null, reason: "UNAUTHENTICATED" };
  if (!hasPermission(context.role, permission)) return { allowed: false, context, reason: "FORBIDDEN" };
  if (companyId && !canAccessCompany(context, companyId)) return { allowed: false, context, reason: "COMPANY_SCOPE" };
  return { allowed: true, context };
}

export class AccessDeniedError extends Error {
  constructor(public readonly reason: "UNAUTHENTICATED" | "FORBIDDEN" | "COMPANY_SCOPE") {
    super("이 작업을 수행할 권한이 없습니다.");
    this.name = "AccessDeniedError";
  }
}

export class AuthenticationRequiredError extends AccessDeniedError {
  constructor() {
    super("UNAUTHENTICATED");
    this.name = "AuthenticationRequiredError";
  }
}

export class PermissionDeniedError extends AccessDeniedError {
  constructor() {
    super("FORBIDDEN");
    this.name = "PermissionDeniedError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor() {
    super("요청한 리소스를 찾을 수 없습니다.");
    this.name = "ResourceNotFoundError";
  }
}

export function isAccessControlError(error: unknown): error is AccessDeniedError | ResourceNotFoundError {
  return error instanceof AccessDeniedError || error instanceof ResourceNotFoundError;
}

export async function requirePermission(permission: Permission, companyId?: string) {
  const decision = await authorizeAccess(permission, companyId);
  if (!decision.allowed) throw new AccessDeniedError(decision.reason);
  return decision.context;
}

export async function requireAuth() {
  const context = await getCurrentAccessContext();
  if (!context) throw new AuthenticationRequiredError();
  return context;
}

export async function requireRole(roles: readonly AccessContext["role"][]) {
  const context = await requireAuth();
  if (!roles.includes(context.role)) throw new PermissionDeniedError();
  return context;
}

export async function requireCompanyAccess(companyId: string, permission?: Permission) {
  const context = permission ? await requirePermission(permission) : await requireAuth();
  if (!canAccessCompany(context, companyId)) throw new PermissionDeniedError();
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) throw new ResourceNotFoundError();
  return context;
}

export async function requirePropertyAccess(propertyId: string, permission?: Permission) {
  const context = permission ? await requirePermission(permission) : await requireAuth();
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, companyId: true } });
  if (!property) throw new ResourceNotFoundError();
  if (!canAccessCompany(context, property.companyId) || !canAccessProperty(context, property.id)) throw new PermissionDeniedError();
  return context;
}

export async function requireRoomAccess(roomId: string, permission?: Permission) {
  const context = permission ? await requirePermission(permission) : await requireAuth();
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { id: true, propertyId: true, property: { select: { companyId: true } } } });
  if (!room) throw new ResourceNotFoundError();
  if (!canAccessCompany(context, room.property.companyId) || !canAccessRoom(context, room)) throw new PermissionDeniedError();
  return context;
}

export async function requireCalendarSourceAccess(calendarSourceId: string, permission?: Permission) {
  const source = await prisma.calendarSource.findUnique({ where: { id: calendarSourceId }, select: { roomId: true } });
  if (!source) throw new ResourceNotFoundError();
  return requireRoomAccess(source.roomId, permission);
}

export const FORBIDDEN_ACTION_RESULT = { success: false, status: 403, errorCode: "FORBIDDEN", message: "접근 권한이 없습니다." } as const;
export const ROLE_PREVIEW_WRITE_BLOCKED_RESULT = { success: false, status: 403, errorCode: "FORBIDDEN", message: ROLE_PREVIEW_WRITE_BLOCKED_MESSAGE } as const;

export function getRolePreviewWriteBlock(context: AccessContext | null | undefined) {
  return context && isRolePreviewActive(context) ? ROLE_PREVIEW_WRITE_BLOCKED_RESULT : null;
}
