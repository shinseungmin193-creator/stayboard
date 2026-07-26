import { z } from "zod";

const id = z.string().trim().min(1).max(100);
const role = z.enum(["ADMIN", "STAFF"]);
export const memberListSchema = z.object({ companyId: id, page: z.coerce.number().int().min(1).default(1), query: z.string().trim().max(100).default(""), filter: z.enum(["ALL", "ADMIN", "STAFF", "INVITED", "DISABLED"]).default("ALL") });
export const inviteMemberSchema = z.object({ companyId: id, email: z.string().trim().toLowerCase().email(), displayName: z.string().trim().max(50).optional().transform((v) => v || undefined), role, propertyIds: z.array(id).default([]), message: z.string().trim().max(500).optional().transform((v) => v || undefined) }).superRefine((value, context) => { if (value.role === "STAFF" && !value.propertyIds.length) context.addIssue({ code: "custom", path: ["propertyIds"], message: "직원은 접근 가능한 숙소를 하나 이상 선택해야 합니다." }); });
export const updateMemberSchema = z.object({ companyId: id, membershipId: id, name: z.string().trim().min(2).max(50), role, propertyIds: z.array(id).default([]) }).superRefine((value, context) => { if (value.role === "STAFF" && !value.propertyIds.length) context.addIssue({ code: "custom", path: ["propertyIds"], message: "직원은 접근 가능한 숙소를 하나 이상 선택해야 합니다." }); });
export const memberStatusSchema = z.object({ companyId: id, membershipId: id, active: z.enum(["true", "false"]).transform((value) => value === "true") });
export const invitationActionSchema = z.object({ companyId: id, invitationId: id });
export const acceptInvitationSchema = z.object({ token: z.string().trim().min(20), name: z.string().trim().min(2).max(50).optional(), password: z.string().min(8).max(128).optional() });
