import { z } from "zod";
const id = z.string().cuid();
export const invitationCodeInputSchema = z.object({
  companyId: id,
  role: z.enum(["ADMIN", "STAFF"]),
  expiresAt: z.string().trim().optional().transform((value) => value ? new Date(`${value}T23:59:59.999+09:00`) : null).refine((value) => value === null || !Number.isNaN(value.getTime()), "만료일을 확인해 주세요."),
  maxUses: z.coerce.number().int().min(1).max(10000).default(1),
});
export const invitationCodeActionSchema = z.object({ companyId: id, codeId: id });
export const invitationCodeVerifySchema = z.object({ code: z.string().trim().min(20).max(100) });
