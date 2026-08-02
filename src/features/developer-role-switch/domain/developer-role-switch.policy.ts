import {
  DEVELOPER_ROLE_PROPERTY_SCOPE_MODES,
  DEVELOPER_ROLE_SWITCH_ROLES,
  type DeveloperRolePropertyScope,
  type DeveloperRolePropertyScopeMode,
  type DeveloperRoleSwitchRole,
} from "./developer-role-switch.types";

export interface DeveloperRoleSwitchEnvironment {
  ENABLE_DEVELOPER_ROLE_SWITCH?: string;
  NODE_ENV?: string;
}

export function isDeveloperRoleSwitchRole(value: unknown): value is DeveloperRoleSwitchRole {
  return typeof value === "string" && DEVELOPER_ROLE_SWITCH_ROLES.includes(value as DeveloperRoleSwitchRole);
}

export function isDeveloperRolePropertyScopeMode(value: unknown): value is DeveloperRolePropertyScopeMode {
  return typeof value === "string" && DEVELOPER_ROLE_PROPERTY_SCOPE_MODES.includes(value as DeveloperRolePropertyScopeMode);
}

export function canUseDeveloperRoleSwitch(
  environment: DeveloperRoleSwitchEnvironment,
  user: { actualRole: string; status?: string; isActive?: boolean },
) {
  return environment.ENABLE_DEVELOPER_ROLE_SWITCH === "true"
    && user.actualRole === "DEVELOPER"
    && user.status === "ACTIVE"
    && user.isActive === true;
}

export function parseDeveloperRolePropertyScope(value: unknown): DeveloperRolePropertyScope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!isDeveloperRolePropertyScopeMode(record.mode) || !Array.isArray(record.propertyIds)) return null;
  if (!record.propertyIds.every((propertyId) => typeof propertyId === "string" && propertyId.length > 0)) return null;
  return { mode: record.mode, propertyIds: [...new Set(record.propertyIds)] };
}

export type DeveloperRoleScopeValidation =
  | { valid: true; storedScope: DeveloperRolePropertyScope; allowedPropertyIds: string[] }
  | { valid: false; reason: "INVALID_ROLE" | "INVALID_SCOPE" | "PROPERTY_REQUIRED" | "PROPERTY_OUT_OF_SCOPE" };

export function validateDeveloperRoleScope(input: {
  previewRole: unknown;
  propertyScopeMode: unknown;
  propertyIds: readonly string[];
  activePropertyIds: readonly string[];
}): DeveloperRoleScopeValidation {
  if (!isDeveloperRoleSwitchRole(input.previewRole)) return { valid: false, reason: "INVALID_ROLE" };
  if (!isDeveloperRolePropertyScopeMode(input.propertyScopeMode)) return { valid: false, reason: "INVALID_SCOPE" };

  const activeIds = new Set(input.activePropertyIds);
  const selectedIds = [...new Set(input.propertyIds.map((value) => value.trim()).filter(Boolean))];
  if (input.previewRole === "ADMIN" || input.propertyScopeMode === "ALL") {
    return {
      valid: true,
      storedScope: { mode: "ALL", propertyIds: [] },
      allowedPropertyIds: [...activeIds],
    };
  }
  if (!selectedIds.length) return { valid: false, reason: "PROPERTY_REQUIRED" };
  if (selectedIds.some((propertyId) => !activeIds.has(propertyId))) {
    return { valid: false, reason: "PROPERTY_OUT_OF_SCOPE" };
  }
  return {
    valid: true,
    storedScope: { mode: "SELECTED", propertyIds: selectedIds },
    allowedPropertyIds: selectedIds,
  };
}
