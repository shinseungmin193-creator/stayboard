import type { ReservationStatus } from "@/lib/generated/prisma/enums";

export const RESERVATION_PAGE_SIZE = 25;
export const RESERVATION_DEFAULT_FUTURE_DAYS = 180;
export const RESERVATION_CONFLICT_DETAILS_PAGE_LIMIT = 100;
export const ACTIVE_OTA_RESERVATION_STATUSES = ["CONFIRMED", "TENTATIVE"] as const satisfies readonly ReservationStatus[];
