import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SIDEBAR_MENU_ALLOWED_ROLES,
  normalizeSidebarMenuAllowedRoles,
  type SidebarMenuAllowedRoles,
} from "../domain/sidebar-preference";

export const GLOBAL_SIDEBAR_MENU_POLICY_ID = "global";

export const findSidebarMenuAllowedRoles = cache(async (): Promise<SidebarMenuAllowedRoles> => {
  const policy = await prisma.sidebarMenuPolicy.findUnique({
    where: { id: GLOBAL_SIDEBAR_MENU_POLICY_ID },
    select: { allowedRoles: true },
  });
  return policy
    ? normalizeSidebarMenuAllowedRoles(policy.allowedRoles)
    : structuredClone(DEFAULT_SIDEBAR_MENU_ALLOWED_ROLES);
});
