import { z } from "zod";
import { USER_ROLES } from "@/features/access-control";

const id = z.string().trim().min(1);
const password = z.string().min(8, "비밀번호는 8자 이상이어야 합니다.").max(128);

export const createManagedUserSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.string().trim().toLowerCase().email(),
  password,
  role: z.enum(USER_ROLES),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
  companyId: z.string().trim().optional(),
  propertyIds: z.array(id).default([]),
  roomIds: z.array(id).default([]),
});
export const managedUserActiveSchema = z.object({ userId: id, isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
export const resetManagedUserPasswordSchema = z.object({ userId: id, password });
export const managedUserRoleSchema = z.object({ userId: id, role: z.enum(USER_ROLES), companyId: z.string().trim().optional() });
export const staffAssignmentsSchema = z.object({ userId: id, companyId: id, propertyIds: z.array(id).default([]), roomIds: z.array(id).default([]) });
