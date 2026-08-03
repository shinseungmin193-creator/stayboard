import { z } from "zod";

import type { SidebarMenuId } from "@/features/sidebar-preferences/domain/sidebar-menu";
import {
  STAFF_BOTTOM_NAVIGATION_SLOT_COUNT,
  STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
} from "./domain/mobile-navigation-preference";

const allowedIds = new Set<SidebarMenuId>(STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS);
const itemId = z.custom<SidebarMenuId>((value) => (
  typeof value === "string" && allowedIds.has(value as SidebarMenuId)
));

export const mobileNavigationPreferenceInputSchema = z.object({
  companyId: z.string().trim().min(1).max(100),
  itemOrder: z.array(itemId).length(STAFF_BOTTOM_NAVIGATION_SLOT_COUNT),
});

export const mobileNavigationPreferenceResetSchema = z.object({
  companyId: z.string().trim().min(1).max(100),
});
