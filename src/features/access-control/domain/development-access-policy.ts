import type { AccessContext } from "./access-control";
import { isUserRole } from "./access-control";

export interface DevelopmentAccessEnvironment {
  NODE_ENV?: string;
  STAYBOARD_DEV_ACCESS_ENABLED?: string;
  STAYBOARD_DEV_ACCESS_ROLE?: string;
  STAYBOARD_DEV_ACCESS_USER_ID?: string;
  STAYBOARD_DEV_ACCESS_COMPANY_IDS?: string;
}

export function resolveDevelopmentAccessContext(environment: DevelopmentAccessEnvironment): AccessContext | null {
  if (environment.NODE_ENV === "production" || environment.STAYBOARD_DEV_ACCESS_ENABLED !== "true") return null;
  if (!isUserRole(environment.STAYBOARD_DEV_ACCESS_ROLE)) return null;

  const role = environment.STAYBOARD_DEV_ACCESS_ROLE;
  const configuredUserId = environment.STAYBOARD_DEV_ACCESS_USER_ID?.trim();
  if (role === "DEVELOPER") {
    return { userId: configuredUserId || "development:developer", actualRole: role, previewRole: null, effectiveRole: role, role, systemRole: "DEVELOPER", companyRole: null, scope: { mode: "all" }, source: "development-bootstrap" };
  }

  const companyIds = [...new Set((environment.STAYBOARD_DEV_ACCESS_COMPANY_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
  if (!companyIds.length) return null;
  return { userId: configuredUserId || `development:${role.toLowerCase()}:${companyIds.join(",")}`, actualRole: role, previewRole: null, effectiveRole: role, role, systemRole: "NONE", companyRole: role, scope: { mode: "companies", companyIds }, source: "development-bootstrap" };
}
