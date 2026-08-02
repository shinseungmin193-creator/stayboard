import { z } from "zod";

export const developerRoleSwitchInputSchema = z.object({
  previewRole: z.enum(["ADMIN", "STAFF"]),
  companyId: z.string().trim().min(1).max(100),
  propertyScopeMode: z.enum(["ALL", "SELECTED"]),
  propertyIds: z.array(z.string().trim().min(1).max(100)).max(500).default([]),
});
