import { z } from "zod";

export const invitationCodeActionSchema = z.object({ codeId: z.string().cuid() });
export const invitationCodeVerifySchema = z.object({ code: z.string().trim().min(20).max(100) });
