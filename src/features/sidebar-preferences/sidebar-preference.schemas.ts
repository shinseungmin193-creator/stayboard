import { z } from "zod";
import { USER_ROLES } from "@/features/access-control/domain/access-control";
import { isSidebarDividerId } from "./domain/sidebar-preference";
import { isSidebarMenuId, SIDEBAR_MENU_ITEMS } from "./domain/sidebar-menu";

const sidebarMenuOrderItemSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MENU"), key: z.string().refine(isSidebarMenuId) }),
  z.object({ type: z.literal("DIVIDER"), id: z.string().refine(isSidebarDividerId) }),
]);

export const sidebarPreferenceInputSchema = z.object({
  menuOrder: z.array(z.union([z.string().refine(isSidebarMenuId), sidebarMenuOrderItemSchema])).max(SIDEBAR_MENU_ITEMS.length + 50),
  hiddenMenuIds: z.array(z.string()).max(SIDEBAR_MENU_ITEMS.length),
  customLabels: z.record(z.string(), z.string().trim().min(1).max(20)).refine((labels) => Object.keys(labels).every(isSidebarMenuId)),
  allowedRoles: z.record(z.string(), z.array(z.enum(USER_ROLES)).max(USER_ROLES.length))
    .refine((roles) => Object.keys(roles).every(isSidebarMenuId)),
});
