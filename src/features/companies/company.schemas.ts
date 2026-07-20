import { z } from "zod";
import { NAME_MAX_LENGTH } from "@/lib/constants";

export const companyInputSchema = z.object({ name: z.string().trim().min(1, "회사명을 입력해 주세요.").max(NAME_MAX_LENGTH, `회사명은 ${NAME_MAX_LENGTH}자 이하여야 합니다.`) });
export const companyUpdateSchema = companyInputSchema.extend({ id: z.string().trim().min(1) });
export const companyActiveSchema = z.object({ id: z.string().trim().min(1), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
