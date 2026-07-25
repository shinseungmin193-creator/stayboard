import { z } from "zod";
import { RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";

export const GUEST_FALLBACK_MODES = ["PROVIDER", "GENERIC"] as const;
export type GuestFallbackModeValue = (typeof GUEST_FALLBACK_MODES)[number];

export interface CompanySettingsValues {
  timezone: string;
  defaultCheckInTime: string;
  defaultCheckOutTime: string;
  nextReservationDisplayDays: number;
  showFutureReservationsAsVacant: boolean;
  showBlockedAsRoomStatus: boolean;
  conflictDisplayLabel: string;
  guestFallbackMode: GuestFallbackModeValue;
  showNextReservationOnVacant: boolean;
  cleaningStatusEnabled: boolean;
  inspectionStatusEnabled: boolean;
  autoMarkCleaningRequired: boolean;
  showSyncFailureWarnings: boolean;
  showSyncSuccessMessage: boolean;
  recentSyncLogLimit: number;
}

export const DEFAULT_COMPANY_SETTINGS = {
  timezone: "Asia/Tokyo",
  defaultCheckInTime: "15:00",
  defaultCheckOutTime: "10:00",
  nextReservationDisplayDays: 7,
  showFutureReservationsAsVacant: true,
  showBlockedAsRoomStatus: false,
  conflictDisplayLabel: RESERVATION_CONFLICT_UI.label,
  guestFallbackMode: "PROVIDER",
  showNextReservationOnVacant: true,
  cleaningStatusEnabled: true,
  inspectionStatusEnabled: true,
  autoMarkCleaningRequired: false,
  showSyncFailureWarnings: true,
  showSyncSuccessMessage: false,
  recentSyncLogLimit: 10,
} as const satisfies CompanySettingsValues;

function isIanaTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간은 HH:mm 형식으로 입력해 주세요.");

export const companySettingsInputSchema = z.object({
  companyId: z.string().trim().min(1, "회사를 선택해 주세요."),
  timezone: z.string().trim().min(1, "시간대를 입력해 주세요.").refine(isIanaTimezone, "유효한 IANA 시간대를 입력해 주세요."),
  defaultCheckInTime: timeSchema,
  defaultCheckOutTime: timeSchema,
  nextReservationDisplayDays: z.coerce.number().int().min(1, "표시 기간은 1일 이상이어야 합니다.").max(30, "표시 기간은 30일 이하여야 합니다."),
  showFutureReservationsAsVacant: z.boolean(),
  showBlockedAsRoomStatus: z.boolean(),
  conflictDisplayLabel: z.string().trim().min(1, `${RESERVATION_CONFLICT_UI.label} 표시명을 입력해 주세요.`).max(20, `${RESERVATION_CONFLICT_UI.label} 표시명은 20자 이하여야 합니다.`),
  guestFallbackMode: z.enum(GUEST_FALLBACK_MODES),
  showNextReservationOnVacant: z.boolean(),
  cleaningStatusEnabled: z.boolean(),
  inspectionStatusEnabled: z.boolean(),
  autoMarkCleaningRequired: z.boolean(),
  showSyncFailureWarnings: z.boolean(),
  showSyncSuccessMessage: z.boolean(),
  recentSyncLogLimit: z.coerce.number().int().min(1, "SyncLog 표시 개수는 1개 이상이어야 합니다.").max(50, "SyncLog 표시 개수는 50개 이하여야 합니다."),
});

export type CompanySettingsInput = z.infer<typeof companySettingsInputSchema>;

export function withCompanySettingsDefaults(settings: Partial<CompanySettingsValues> | null | undefined): CompanySettingsValues {
  return { ...DEFAULT_COMPANY_SETTINGS, ...settings };
}
