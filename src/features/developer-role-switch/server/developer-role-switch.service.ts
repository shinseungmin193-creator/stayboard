import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/features/auth/server/get-current-user";
import {
  canUseDeveloperRoleSwitch,
  parseDeveloperRolePropertyScope,
  validateDeveloperRoleScope,
} from "../domain/developer-role-switch.policy";
import type {
  ActiveDeveloperRoleSwitch,
  DeveloperRoleSwitchActionInput,
  DeveloperRoleSwitchOptions,
} from "../domain/developer-role-switch.types";
import { findDeveloperRoleSessionByTokenHash, listDeveloperRoleSwitchCompanies } from "./developer-role-switch.repository";
import {
  createDeveloperRoleSwitchToken,
  DEVELOPER_ROLE_SWITCH_MAX_AGE_SECONDS,
  hashDeveloperRoleSwitchToken,
  isPlausibleDeveloperRoleSwitchToken,
} from "./developer-role-switch.session";

export type DeveloperRoleSwitchErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "DISABLED"
  | "INVALID_INPUT"
  | "COMPANY_UNAVAILABLE"
  | "PROPERTY_REQUIRED"
  | "PROPERTY_OUT_OF_SCOPE"
  | "SESSION_UNAVAILABLE"
  | "SESSION_EXPIRED";

export class DeveloperRoleSwitchError extends Error {
  constructor(public readonly code: DeveloperRoleSwitchErrorCode) {
    super(code);
    this.name = "DeveloperRoleSwitchError";
  }
}

interface DeveloperActor {
  id: string;
  systemRole: "NONE" | "DEVELOPER";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  isActive: boolean;
}

function assertDeveloperActor(actor: DeveloperActor | null | undefined) {
  if (!actor) throw new DeveloperRoleSwitchError("UNAUTHENTICATED");
  if (!canUseDeveloperRoleSwitch(process.env, {
    actualRole: actor.systemRole === "DEVELOPER" ? "DEVELOPER" : "STAFF",
    status: actor.status,
    isActive: actor.isActive,
  })) {
    if (process.env.ENABLE_DEVELOPER_ROLE_SWITCH !== "true") throw new DeveloperRoleSwitchError("DISABLED");
    throw new DeveloperRoleSwitchError("FORBIDDEN");
  }
}

function sessionDetails(input: {
  sessionId: string;
  previewRole: "ADMIN" | "STAFF";
  companyId: string;
  propertyScope: Prisma.InputJsonValue;
  startedAt?: Date;
  endedAt?: Date;
  reason?: string;
}) {
  return {
    developerRoleSessionId: input.sessionId,
    actualRole: "DEVELOPER",
    effectiveRole: input.previewRole,
    previewRole: input.previewRole,
    companyId: input.companyId,
    propertyScope: input.propertyScope,
    ...(input.startedAt ? { startedAt: input.startedAt.toISOString() } : {}),
    ...(input.endedAt ? { endedAt: input.endedAt.toISOString() } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  } satisfies Prisma.InputJsonObject;
}

function toJsonScope(scope: { mode: "ALL" | "SELECTED"; propertyIds: string[] }): Prisma.InputJsonObject {
  return { mode: scope.mode, propertyIds: scope.propertyIds };
}

async function validateSelection(client: Prisma.TransactionClient, input: DeveloperRoleSwitchActionInput) {
  const company = await client.company.findFirst({
    where: { id: input.companyId, isActive: true },
    select: {
      id: true,
      name: true,
      properties: {
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!company) throw new DeveloperRoleSwitchError("COMPANY_UNAVAILABLE");
  const scope = validateDeveloperRoleScope({
    previewRole: input.previewRole,
    propertyScopeMode: input.propertyScopeMode,
    propertyIds: input.propertyIds,
    activePropertyIds: company.properties.map((property) => property.id),
  });
  if (!scope.valid) {
    throw new DeveloperRoleSwitchError(scope.reason === "PROPERTY_REQUIRED" ? "PROPERTY_REQUIRED" : scope.reason === "PROPERTY_OUT_OF_SCOPE" ? "PROPERTY_OUT_OF_SCOPE" : "INVALID_INPUT");
  }
  return { company, ...scope };
}

export async function getDeveloperRoleSwitchOptions(actor: DeveloperActor | null | undefined): Promise<DeveloperRoleSwitchOptions | null> {
  try {
    assertDeveloperActor(actor);
  } catch {
    return null;
  }
  return { companies: await listDeveloperRoleSwitchCompanies() };
}

export async function getCurrentDeveloperRoleSwitchOptions() {
  return getDeveloperRoleSwitchOptions(await getCurrentUser());
}

export async function startDeveloperRoleSession(
  actor: DeveloperActor | null | undefined,
  input: DeveloperRoleSwitchActionInput,
  currentBrowserToken: string | null,
) {
  assertDeveloperActor(actor);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEVELOPER_ROLE_SWITCH_MAX_AGE_SECONDS * 1000);
  const { token, tokenHash } = createDeveloperRoleSwitchToken();
  const currentTokenHash = currentBrowserToken && isPlausibleDeveloperRoleSwitchToken(currentBrowserToken)
    ? hashDeveloperRoleSwitchToken(currentBrowserToken)
    : null;

  const created = await prisma.$transaction(async (tx) => {
    const { company, storedScope, allowedPropertyIds } = await validateSelection(tx, input);
    const storedScopeJson = toJsonScope(storedScope);
    if (currentTokenHash) {
      const replaced = await tx.developerRoleSession.findFirst({
        where: { tokenHash: currentTokenHash, developerUserId: actor!.id, revokedAt: null },
        select: { id: true, previewRole: true, companyId: true, propertyScope: true },
      });
      if (replaced) {
        const revoked = await tx.developerRoleSession.updateMany({
          where: { id: replaced.id, tokenHash: currentTokenHash, developerUserId: actor!.id, revokedAt: null },
          data: { revokedAt: now },
        });
        if (revoked.count) {
          await tx.auditLog.create({
            data: {
              actorUserId: actor!.id,
              targetCompanyId: replaced.companyId,
              action: "DEVELOPER_ROLE_SWITCH_ENDED",
              details: sessionDetails({
                sessionId: replaced.id,
                previewRole: replaced.previewRole,
                companyId: replaced.companyId,
                propertyScope: replaced.propertyScope as Prisma.InputJsonValue,
                endedAt: now,
                reason: "REPLACED_BY_NEW_SESSION",
              }),
            },
          });
        }
      }
    }
    const session = await tx.developerRoleSession.create({
      data: {
        tokenHash,
        developerUserId: actor!.id,
        previewRole: input.previewRole,
        companyId: company.id,
        propertyScope: storedScopeJson,
        expiresAt,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        actorUserId: actor!.id,
        targetCompanyId: company.id,
        action: "DEVELOPER_ROLE_SWITCH_STARTED",
        details: sessionDetails({ sessionId: session.id, previewRole: input.previewRole, companyId: company.id, propertyScope: storedScopeJson, startedAt: now }),
      },
    });
    return { ...session, company, storedScope, allowedPropertyIds };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return {
    token,
    active: {
      sessionId: created.id,
      previewRole: input.previewRole,
      companyId: created.company.id,
      companyName: created.company.name,
      propertyScope: created.storedScope,
      allowedPropertyIds: created.allowedPropertyIds,
      expiresAt: expiresAt.toISOString(),
    } satisfies ActiveDeveloperRoleSwitch,
  };
}

export async function updateDeveloperRoleSession(
  actor: DeveloperActor | null | undefined,
  input: DeveloperRoleSwitchActionInput,
  currentBrowserToken: string | null,
) {
  assertDeveloperActor(actor);
  if (!isPlausibleDeveloperRoleSwitchToken(currentBrowserToken)) throw new DeveloperRoleSwitchError("SESSION_UNAVAILABLE");
  const tokenHash = hashDeveloperRoleSwitchToken(currentBrowserToken);
  const current = await findDeveloperRoleSessionByTokenHash(tokenHash);
  const now = new Date();
  if (!current || current.developerUserId !== actor!.id || current.revokedAt) throw new DeveloperRoleSwitchError("SESSION_UNAVAILABLE");
  if (current.expiresAt <= now) {
    await expireDeveloperRoleSession(current, now, "EXPIRED_DURING_UPDATE");
    throw new DeveloperRoleSwitchError("SESSION_EXPIRED");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const { company, storedScope, allowedPropertyIds } = await validateSelection(tx, input);
    const storedScopeJson = toJsonScope(storedScope);
    const result = await tx.developerRoleSession.updateMany({
      where: { id: current.id, tokenHash, developerUserId: actor!.id, revokedAt: null, expiresAt: { gt: now } },
      data: { previewRole: input.previewRole, companyId: company.id, propertyScope: storedScopeJson },
    });
    if (!result.count) throw new DeveloperRoleSwitchError("SESSION_UNAVAILABLE");
    await tx.auditLog.create({
      data: {
        actorUserId: actor!.id,
        targetCompanyId: company.id,
        action: "DEVELOPER_ROLE_SWITCH_UPDATED",
        details: sessionDetails({ sessionId: current.id, previewRole: input.previewRole, companyId: company.id, propertyScope: storedScopeJson }),
      },
    });
    return { id: current.id, company, storedScope, allowedPropertyIds };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return {
    token: currentBrowserToken,
    active: {
      sessionId: updated.id,
      previewRole: input.previewRole,
      companyId: updated.company.id,
      companyName: updated.company.name,
      propertyScope: updated.storedScope,
      allowedPropertyIds: updated.allowedPropertyIds,
      expiresAt: current.expiresAt.toISOString(),
    } satisfies ActiveDeveloperRoleSwitch,
  };
}

export async function revokeDeveloperRoleSessionByToken(token: string | null, reason: string) {
  if (!isPlausibleDeveloperRoleSwitchToken(token)) return false;
  const tokenHash = hashDeveloperRoleSwitchToken(token);
  const current = await findDeveloperRoleSessionByTokenHash(tokenHash);
  if (!current || current.revokedAt) return false;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const result = await tx.developerRoleSession.updateMany({
      where: { id: current.id, tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
    if (!result.count) return false;
    await tx.auditLog.create({
      data: {
        actorUserId: current.developerUserId,
        targetCompanyId: current.companyId,
        action: "DEVELOPER_ROLE_SWITCH_ENDED",
        details: sessionDetails({ sessionId: current.id, previewRole: current.previewRole, companyId: current.companyId, propertyScope: current.propertyScope as Prisma.InputJsonValue, endedAt: now, reason }),
      },
    });
    return true;
  });
}

export async function expireDeveloperRoleSession(
  session: Awaited<ReturnType<typeof findDeveloperRoleSessionByTokenHash>> & {},
  now = new Date(),
  reason = "EXPIRED",
) {
  if (!session || session.revokedAt) return false;
  return prisma.$transaction(async (tx) => {
    const result = await tx.developerRoleSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    if (!result.count) return false;
    await tx.auditLog.create({
      data: {
        actorUserId: session.developerUserId,
        targetCompanyId: session.companyId,
        action: "DEVELOPER_ROLE_SWITCH_EXPIRED",
        details: sessionDetails({ sessionId: session.id, previewRole: session.previewRole, companyId: session.companyId, propertyScope: session.propertyScope as Prisma.InputJsonValue, endedAt: now, reason }),
      },
    });
    return true;
  });
}

export async function resolveDeveloperRoleSession(input: {
  actor: DeveloperActor | null | undefined;
  token: string | null;
  now?: Date;
}): Promise<{ status: "NONE" | "STALE" | "ACTIVE"; active: ActiveDeveloperRoleSwitch | null }> {
  if (!input.token) return { status: "NONE", active: null };
  if (!input.actor || !canUseDeveloperRoleSwitch(process.env, {
    actualRole: input.actor.systemRole === "DEVELOPER" ? "DEVELOPER" : "STAFF",
    status: input.actor.status,
    isActive: input.actor.isActive,
  }) || !isPlausibleDeveloperRoleSwitchToken(input.token)) return { status: "STALE", active: null };

  const session = await findDeveloperRoleSessionByTokenHash(hashDeveloperRoleSwitchToken(input.token));
  if (!session || session.developerUserId !== input.actor.id || session.revokedAt) return { status: "STALE", active: null };
  const now = input.now ?? new Date();
  if (session.expiresAt <= now || !session.company.isActive || session.developer.systemRole !== "DEVELOPER" || session.developer.status !== "ACTIVE" || !session.developer.isActive) {
    await expireDeveloperRoleSession(session, now, session.expiresAt <= now ? "EXPIRED" : "ACCOUNT_OR_COMPANY_UNAVAILABLE");
    return { status: "STALE", active: null };
  }
  const propertyScope = parseDeveloperRolePropertyScope(session.propertyScope);
  if (!propertyScope) {
    await expireDeveloperRoleSession(session, now, "INVALID_PROPERTY_SCOPE");
    return { status: "STALE", active: null };
  }
  const scope = validateDeveloperRoleScope({
    previewRole: session.previewRole,
    propertyScopeMode: propertyScope.mode,
    propertyIds: propertyScope.propertyIds,
    activePropertyIds: session.company.properties.map((property) => property.id),
  });
  if (!scope.valid) {
    await expireDeveloperRoleSession(session, now, "PROPERTY_SCOPE_UNAVAILABLE");
    return { status: "STALE", active: null };
  }
  return {
    status: "ACTIVE",
    active: {
      sessionId: session.id,
      previewRole: session.previewRole,
      companyId: session.companyId,
      companyName: session.company.name,
      propertyScope,
      allowedPropertyIds: scope.allowedPropertyIds,
      expiresAt: session.expiresAt.toISOString(),
    },
  };
}
