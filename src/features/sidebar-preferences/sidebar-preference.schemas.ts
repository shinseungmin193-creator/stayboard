import { z } from "zod";
import { isSidebarMenuId, SIDEBAR_MENU_ITEMS } from "./domain/sidebar-menu";

export const sidebarPreferenceInputSchema = z.object({
  menuOrder: z.array(z.string()).max(SIDEBAR_MENU_ITEMS.length),
  hiddenMenuIds: z.array(z.string()).max(SIDEBAR_MENU_ITEMS.length),
  customLabels: z.record(z.string(), z.string().trim().min(1).max(20)).refine((labels) => Object.keys(labels).every(isSidebarMenuId)),
});
