import { z } from "zod";
import { ADDRESS_MAX_LENGTH, DEFAULT_TIMEZONE, NAME_MAX_LENGTH } from "@/lib/constants";

function isSupportedTimezone(value: string): boolean {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("timeZone").includes(value);
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch { return false; }
}

export const propertyInputSchema = z.object({
  companyId: z.string().trim().min(1, "회사를 선택해 주세요."),
  name: z.string().trim().min(1, "숙소명을 입력해 주세요.").max(NAME_MAX_LENGTH, `숙소명은 ${NAME_MAX_LENGTH}자 이하여야 합니다.`),
  address: z.string().trim().min(1, "주소를 입력해 주세요.").max(ADDRESS_MAX_LENGTH, `주소는 ${ADDRESS_MAX_LENGTH}자 이하여야 합니다.`),
  timezone: z.string().trim().default(DEFAULT_TIMEZONE).refine(isSupportedTimezone, "유효한 IANA 타임존을 입력해 주세요."),
});

export const propertyUpdateSchema = propertyInputSchema.extend({ id: z.string().trim().min(1) });
export const propertyActiveSchema = z.object({ id: z.string().trim().min(1), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
