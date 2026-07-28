import { z } from "zod";

export const invitationCodeActionSchema = z.object({ codeId: z.string().cuid() });
export const invitationCodeCreateSchema = z.object({ role: z.enum(["ADMIN", "STAFF"]) });
export const invitationCodeVerifySchema = z.object({ code: z.string().trim().min(20).max(100) });
