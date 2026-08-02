export const DEVELOPER_ROLE_SWITCH_ROLES = ["ADMIN", "STAFF"] as const;
export type DeveloperRoleSwitchRole = (typeof DEVELOPER_ROLE_SWITCH_ROLES)[number];

export const DEVELOPER_ROLE_PROPERTY_SCOPE_MODES = ["ALL", "SELECTED"] as const;
export type DeveloperRolePropertyScopeMode = (typeof DEVELOPER_ROLE_PROPERTY_SCOPE_MODES)[number];

export interface DeveloperRolePropertyScope {
  mode: DeveloperRolePropertyScopeMode;
  propertyIds: string[];
}

export interface DeveloperRoleSwitchCompanyOption {
  id: string;
  name: string;
  properties: Array<{ id: string; name: string }>;
}

export interface DeveloperRoleSwitchOptions {
  companies: DeveloperRoleSwitchCompanyOption[];
}

export interface ActiveDeveloperRoleSwitch {
  sessionId: string;
  previewRole: DeveloperRoleSwitchRole;
  companyId: string;
  companyName: string;
  propertyScope: DeveloperRolePropertyScope;
  allowedPropertyIds: string[];
  expiresAt: string;
}

export interface DeveloperRoleSwitchActionInput {
  previewRole: DeveloperRoleSwitchRole;
  companyId: string;
  propertyScopeMode: DeveloperRolePropertyScopeMode;
  propertyIds: string[];
}
