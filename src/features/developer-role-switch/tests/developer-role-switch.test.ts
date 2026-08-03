import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import {
  canUseDeveloperRoleSwitch,
  parseDeveloperRolePropertyScope,
  validateDeveloperRoleScope,
} from "../domain/developer-role-switch.policy";

const enabledEnvironment = { NODE_ENV: "production", ENABLE_DEVELOPER_ROLE_SWITCH: "true" };
const activeDeveloper = { actualRole: "DEVELOPER", status: "ACTIVE", isActive: true };

test("an active DEVELOPER can use the switch in production only with the exact opt-in flag", () => {
  assert.equal(canUseDeveloperRoleSwitch(enabledEnvironment, activeDeveloper), true);
  assert.equal(canUseDeveloperRoleSwitch({ NODE_ENV: "production", ENABLE_DEVELOPER_ROLE_SWITCH: "false" }, activeDeveloper), false);
  assert.equal(canUseDeveloperRoleSwitch({ NODE_ENV: "production", ENABLE_DEVELOPER_ROLE_SWITCH: "TRUE" }, activeDeveloper), false);
  assert.equal(canUseDeveloperRoleSwitch({ NODE_ENV: "development" }, activeDeveloper), false);
});

test("ordinary ADMIN, STAFF, inactive, and suspended users cannot start a switch", () => {
  assert.equal(canUseDeveloperRoleSwitch(enabledEnvironment, { ...activeDeveloper, actualRole: "ADMIN" }), false);
  assert.equal(canUseDeveloperRoleSwitch(enabledEnvironment, { ...activeDeveloper, actualRole: "STAFF" }), false);
  assert.equal(canUseDeveloperRoleSwitch(enabledEnvironment, { ...activeDeveloper, isActive: false }), false);
  assert.equal(canUseDeveloperRoleSwitch(enabledEnvironment, { ...activeDeveloper, status: "SUSPENDED" }), false);
});

test("ADMIN uses all active properties and never accepts a DEVELOPER preview role", () => {
  assert.deepEqual(validateDeveloperRoleScope({
    previewRole: "ADMIN",
    propertyScopeMode: "SELECTED",
    propertyIds: ["property-a"],
    activePropertyIds: ["property-a", "property-b"],
  }), {
    valid: true,
    storedScope: { mode: "ALL", propertyIds: [] },
    allowedPropertyIds: ["property-a", "property-b"],
  });
  assert.deepEqual(validateDeveloperRoleScope({
    previewRole: "DEVELOPER",
    propertyScopeMode: "ALL",
    propertyIds: [],
    activePropertyIds: [],
  }), { valid: false, reason: "INVALID_ROLE" });
});

test("STAFF selected scope rejects empty, foreign, and inactive properties", () => {
  assert.deepEqual(validateDeveloperRoleScope({
    previewRole: "STAFF",
    propertyScopeMode: "SELECTED",
    propertyIds: [],
    activePropertyIds: ["property-a"],
  }), { valid: false, reason: "PROPERTY_REQUIRED" });
  assert.deepEqual(validateDeveloperRoleScope({
    previewRole: "STAFF",
    propertyScopeMode: "SELECTED",
    propertyIds: ["property-foreign"],
    activePropertyIds: ["property-a"],
  }), { valid: false, reason: "PROPERTY_OUT_OF_SCOPE" });
  assert.deepEqual(validateDeveloperRoleScope({
    previewRole: "STAFF",
    propertyScopeMode: "SELECTED",
    propertyIds: ["property-a", "property-a"],
    activePropertyIds: ["property-a", "property-b"],
  }), {
    valid: true,
    storedScope: { mode: "SELECTED", propertyIds: ["property-a"] },
    allowedPropertyIds: ["property-a"],
  });
});

test("tampered persisted property scope is rejected", () => {
  assert.equal(parseDeveloperRolePropertyScope(null), null);
  assert.equal(parseDeveloperRolePropertyScope({ mode: "OWNER", propertyIds: [] }), null);
  assert.equal(parseDeveloperRolePropertyScope({ mode: "SELECTED", propertyIds: [1] }), null);
  assert.deepEqual(parseDeveloperRolePropertyScope({ mode: "SELECTED", propertyIds: ["property-a", "property-a"] }), { mode: "SELECTED", propertyIds: ["property-a"] });
});

test("effective STAFF and ADMIN permissions do not inherit the actual DEVELOPER permissions", () => {
  assert.equal(hasPermission("ADMIN", PERMISSIONS.ADMIN_SETTINGS_MANAGE), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_SETTINGS_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_MANAGE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.USER_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.DEVELOPER_MANAGEMENT_READ), false);
});

test("the session cookie is opaque, hashed in storage, HttpOnly, basePath-aware, and limited to eight hours", () => {
  const source = readFileSync("src/features/developer-role-switch/server/developer-role-switch.session.ts", "utf8");
  assert.match(source, /randomBytes\(32\)/);
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /httpOnly: true/);
  assert.match(source, /sameSite: "lax"/);
  assert.match(source, /secure: USE_SECURE_AUTH_COOKIES/);
  assert.match(source, /path: AUTH_COOKIE_PATH/);
  assert.match(source, /8 \* 60 \* 60/);
  assert.match(source, /\^\[A-Za-z0-9_-/);
});

test("service persists only token hashes and never mutates User or CompanyMembership roles", () => {
  const source = readFileSync("src/features/developer-role-switch/server/developer-role-switch.service.ts", "utf8");
  assert.match(source, /tokenHash/);
  assert.doesNotMatch(source, /data:\s*\{\s*systemRole/);
  assert.doesNotMatch(source, /companyMembership\.(update|create|delete)/);
  assert.match(source, /DEVELOPER_ROLE_SWITCH_STARTED/);
  assert.match(source, /DEVELOPER_ROLE_SWITCH_UPDATED/);
  assert.match(source, /DEVELOPER_ROLE_SWITCH_ENDED/);
  assert.match(source, /DEVELOPER_ROLE_SWITCH_EXPIRED/);
  assert.doesNotMatch(source, /details:[^\n]*(token|tokenHash)/);
});

test("one browser replaces only its own existing session and revoked or expired sessions are unusable", () => {
  const source = readFileSync("src/features/developer-role-switch/server/developer-role-switch.service.ts", "utf8");
  assert.match(source, /tokenHash: currentTokenHash, developerUserId: actor!\.id, revokedAt: null/);
  assert.match(source, /REPLACED_BY_NEW_SESSION/);
  assert.doesNotMatch(source, /updateMany\(\{\s*where: \{ developerUserId: actor!\.id, revokedAt: null \}/);
  assert.match(source, /current\.revokedAt/);
  assert.match(source, /current\.expiresAt <= now/);
  assert.match(source, /session\.expiresAt <= now/);
});

test("central AccessContext applies the selected company/property scope and keeps actualRole DEVELOPER", () => {
  const source = readFileSync("src/features/access-control/application/access-context.ts", "utf8");
  assert.match(source, /actualRole: "DEVELOPER"/);
  assert.match(source, /effectiveRole: active\.previewRole/);
  assert.match(source, /role: active\.previewRole/);
  assert.match(source, /companyIds: \[active\.companyId\], propertyIds: active\.allowedPropertyIds/);
  assert.match(source, /developerRoleSessionId: active\.sessionId/);
});

test("developer-only access is blocked while a role switch is active", () => {
  const source = readFileSync("src/features/developer-management/server/developer-access.ts", "utf8");
  assert.match(source, /context\.isRoleSwitchActive/);
  assert.match(source, /hasPermission\(context\.effectiveRole/);
});

test("global banner can always return to developer mode and logout revokes the current browser session", () => {
  const banner = readFileSync("src/features/developer-role-switch/components/developer-role-switch-banner.tsx", "utf8");
  const logout = readFileSync("src/features/auth/components/account-menu.tsx", "utf8");
  const resetRoute = readFileSync("src/app/api/auth/session-reset/route.ts", "utf8");
  assert.match(banner, /endDeveloperRoleSessionAction/);
  assert.match(banner, /actions\.return/);
  assert.match(logout, /cleanupDeveloperRoleSessionForLogoutAction/);
  assert.match(resetRoute, /revokeDeveloperRoleSessionByToken/);
  assert.match(resetRoute, /name: DEVELOPER_ROLE_SWITCH_COOKIE_NAME/);
  assert.match(resetRoute, /maxAge: 0/);
  assert.match(resetRoute, /path: AUTH_COOKIE_PATH/);
});

test("developer settings renders a visible three-mode card before the existing settings UI", () => {
  const page = readFileSync("src/app/developer/settings/page.tsx", "utf8");
  const card = readFileSync("src/features/developer-role-switch/components/developer-role-switch-card.tsx", "utf8");
  assert.match(page, /<PageHeader[\s\S]*<DeveloperRoleSwitchCard \/>[\s\S]*<DeveloperSettingsProvider>/);
  assert.match(card, /if \(!available\) return null/);
  assert.doesNotMatch(card, /if \(!enabled\) return null/);
  assert.match(card, /modeButton\("DEVELOPER"/);
  assert.match(card, /modeButton\("ADMIN"/);
  assert.match(card, /modeButton\("STAFF"/);
  assert.match(card, /grid grid-cols-3/);
  assert.match(card, /ENABLE_DEVELOPER_ROLE_SWITCH=true/);
});

test("ADMIN and STAFF mode buttons open a role-specific real switch dialog", () => {
  const card = readFileSync("src/features/developer-role-switch/components/developer-role-switch-card.tsx", "utf8");
  const provider = readFileSync("src/features/developer-role-switch/components/developer-role-switch-provider.tsx", "utf8");
  const form = readFileSync("src/features/developer-role-switch/components/developer-role-switch-form.tsx", "utf8");
  assert.match(card, /open\(mode\)/);
  assert.match(provider, /requestedRole/);
  assert.match(provider, /roleLocked=\{requestedRole !== null\}/);
  assert.match(provider, /<DeveloperRoleSwitchForm/);
  assert.match(form, /startDeveloperRoleSessionAction/);
  assert.match(form, /actions\.startAdmin/);
  assert.match(form, /actions\.startStaff/);
  assert.match(form, /actions\.cancel/);
  assert.match(form, /active\?\.companyId \?\? ""/);
});

test("role switch availability is server-derived from actualRole and developer return targets settings", () => {
  const shell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const actions = readFileSync("src/features/developer-role-switch/developer-role-switch.actions.ts", "utf8");
  assert.match(shell, /roleSwitchAvailable = accessContext\?\.actualRole === "DEVELOPER"/);
  assert.match(shell, /available=\{roleSwitchAvailable\}/);
  assert.match(actions, /redirectPath: "\/developer\/settings"/);
});

test("Korean and Japanese messages include the mode controls and disabled-state guidance", () => {
  const ko = JSON.parse(readFileSync("src/messages/ko.json", "utf8")).developerRoleSwitch;
  const ja = JSON.parse(readFileSync("src/messages/ja.json", "utf8")).developerRoleSwitch;
  assert.equal(ko.modeTitle, "권한 테스트 모드");
  assert.equal(ko.developerMode, "개발자 모드");
  assert.equal(ko.modes.ADMIN, "관리자 모드");
  assert.equal(ko.modes.STAFF, "직원 모드");
  assert.match(ko.card.disabled, /비활성화/);
  assert.equal(ja.modeTitle, "権限テストモード");
  assert.equal(ja.modes.ADMIN, "管理者モード");
  assert.equal(ja.modes.STAFF, "スタッフモード");
  assert.match(ja.card.disabled, /無効/);
});

test("important role-switched writes record actual/effective role and session metadata", () => {
  const access = readFileSync("src/features/access-control/domain/access-control.ts", "utf8");
  const users = readFileSync("src/features/user-management/user-management.actions.ts", "utf8");
  const members = readFileSync("src/features/member-management/member-management.actions.ts", "utf8");
  const invitations = readFileSync("src/features/invitation-codes/invitation-code.actions.ts", "utf8");
  const cleaning = readFileSync("src/features/cleaning/server/cleaning-task.service.ts", "utf8");
  assert.match(access, /actualRole: context\.actualRole/);
  assert.match(access, /effectiveRole: context\.effectiveRole/);
  assert.match(access, /developerRoleSessionId: context\.developerRoleSessionId/);
  assert.match(users, /withAccessAuditMetadata/);
  assert.match(members, /withAccessAuditMetadata/);
  assert.match(invitations, /withAccessAuditMetadata/);
  assert.match(cleaning, /auditMetadata/);
});

test("the formal migration only creates the role session structure", () => {
  const migration = readFileSync("prisma/migrations/20260803110000_add_developer_role_sessions/migration.sql", "utf8");
  assert.match(migration, /CREATE TABLE "DeveloperRoleSession"/);
  assert.match(migration, /FOREIGN KEY \("developerUserId"\)/);
  assert.match(migration, /FOREIGN KEY \("companyId"\)/);
  assert.doesNotMatch(migration, /DELETE FROM|DROP TABLE|UPDATE "User"/i);
});
