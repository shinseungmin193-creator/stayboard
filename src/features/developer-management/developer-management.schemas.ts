import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const reason = z.string().trim().min(3).max(500);
const optionalReason = z.string().trim().max(500).default("");
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal(""));
const page = z.coerce.number().int().min(1).default(1);

export const developerUserListSchema = z.object({
  query: z.string().trim().max(100).default(""),
  status: z.enum(["CURRENT", "ACTIVE", "SUSPENDED", "DELETED"]).default("CURRENT"),
  role: z.enum(["ALL", "DEVELOPER", "ADMIN", "STAFF"]).default("ALL"),
  createdFrom: date,
  createdTo: date,
  sort: z.enum(["NEWEST", "OLDEST", "LAST_LOGIN", "NAME"]).default("NEWEST"),
  page,
});

export const developerCompanyListSchema = z.object({
  query: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "NO_ADMIN"]).default("ALL"),
  sort: z.enum(["NEWEST", "OLDEST", "NAME", "RECENT_ACTIVITY"]).default("NEWEST"),
  page,
});

export const developerAuditListSchema = z.object({
  actor: z.string().trim().max(100).default(""),
  target: z.string().trim().max(100).default(""),
  company: z.string().trim().max(100).default(""),
  targetUserId: id.optional().or(z.literal("")),
  targetCompanyId: id.optional().or(z.literal("")),
  action: z.string().trim().max(100).default(""),
  createdFrom: date,
  createdTo: date,
  page,
});

const lastAdminResolution = z.enum(["NONE", "TRANSFER", "SUSPEND_COMPANY"]).default("NONE");

export const suspendUserSchema = z.object({
  userId: id,
  reason,
  lastAdminResolution,
  replacementUserId: id.optional().or(z.literal("")),
});

export const restoreUserSchema = z.object({ userId: id, reason: optionalReason });
export const forceLogoutUserSchema = z.object({ userId: id, reason });

export const deleteUserSchema = z.object({
  userId: id,
  confirmation: z.string().trim().min(1).max(320),
  reason,
  lastAdminResolution,
  replacementUserId: id.optional().or(z.literal("")),
});

export const anonymizeUserSchema = z.object({
  userId: id,
  confirmation: z.string().trim().min(1).max(320),
  reason,
});

export const changeUserRoleSchema = z.object({
  userId: id,
  companyId: id,
  role: z.enum(["ADMIN", "STAFF"]),
  reason,
  lastAdminResolution,
  replacementUserId: id.optional().or(z.literal("")),
});

export const companyStatusSchema = z.object({ companyId: id, reason });
export const transferCompanyAdminSchema = z.object({ companyId: id, replacementUserId: id, reason });
