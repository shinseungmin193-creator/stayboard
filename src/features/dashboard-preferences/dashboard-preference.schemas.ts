import { z } from "zod";
import {
  STAFF_MOBILE_DASHBOARD_CARD_IDS,
  type DashboardCardId,
} from "@/features/dashboard/dashboard-card-policy";

const allowedIds = new Set<DashboardCardId>(STAFF_MOBILE_DASHBOARD_CARD_IDS);
const cardId = z.custom<DashboardCardId>(
  (value) => typeof value === "string" && allowedIds.has(value as DashboardCardId),
);

export const dashboardPreferenceInputSchema = z.object({
  companyId: z.string().trim().min(1).max(100),
  cardOrder: z.array(cardId).length(STAFF_MOBILE_DASHBOARD_CARD_IDS.length),
  hiddenCardIds: z.array(cardId).max(Math.max(0, STAFF_MOBILE_DASHBOARD_CARD_IDS.length - 1)),
});

export const dashboardPreferenceResetSchema = z.object({
  companyId: z.string().trim().min(1).max(100),
});
