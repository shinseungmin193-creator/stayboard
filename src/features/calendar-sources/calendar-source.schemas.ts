import { z } from "zod";
import { CALENDAR_SOURCE_NAME_MAX_LENGTH, CALENDAR_URL_MAX_LENGTH } from "./calendar-source.constants";

export const supportedProviderSchema = z.enum(["AIRBNB", "BOOKING", "AGODA"]);
export const calendarSourceInputSchema = z.object({
  roomId: z.string().trim().min(1, "객실을 선택해 주세요."),
  provider: supportedProviderSchema,
  name: z.string().trim().min(1, "연결 이름을 입력해 주세요.").max(CALENDAR_SOURCE_NAME_MAX_LENGTH),
  calendarUrl: z.string().trim().min(1, "ICS URL을 입력해 주세요.").max(CALENDAR_URL_MAX_LENGTH).url("올바른 URL을 입력해 주세요."),
  isActive: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
});
export const calendarSourceUpdateSchema = calendarSourceInputSchema.omit({ calendarUrl: true }).extend({ id: z.string().trim().min(1) });
export const calendarSourceUrlReplacementSchema = z.object({
  calendarSourceId: z.string().trim().min(1),
  calendarUrl: z.string().trim().min(1, "최신 ICS URL을 입력해 주세요.").max(CALENDAR_URL_MAX_LENGTH).url("올바른 URL을 입력해 주세요."),
});
export const calendarSourceActiveSchema = z.object({ id: z.string().trim().min(1), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
export const calendarSourceIdSchema = z.object({ id: z.string().trim().min(1) });
export const calendarSourceDeleteSchema = z.object({
  calendarSourceId: z.string().trim().cuid(),
  confirmationText: z.string().trim().min(1).max(CALENDAR_SOURCE_NAME_MAX_LENGTH),
});
export const calendarSourceDeleteImpactSchema = calendarSourceDeleteSchema.pick({ calendarSourceId: true });
