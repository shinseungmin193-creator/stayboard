import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canAccessCompany, canAccessRoom, hasPermission, PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES, type AccessContext } from "../domain/access-control";
import { resolveDevelopmentAccessContext } from "../domain/development-access-policy";
import { canUseRolePreview, getAuthorizationRoles, getPreviewRole, isRolePreviewActive } from "../domain/role-preview";

test("DEVELOPER는 모든 Permission을 허용한다", () => {
  for (const permission of Object.values(PERMISSIONS)) assert.equal(hasPermission("DEVELOPER", permission), true);
});
test("ADMIN은 관리자 설정을 허용하고 개발자 설정을 거부한다", () => {
  assert.equal(hasPermission("ADMIN", PERMISSIONS.ADMIN_SETTINGS_MANAGE), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_SETTINGS_READ), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_MANAGEMENT_READ), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_MANAGEMENT_MANAGE), false);
});
test("STAFF는 객실 조회와 운영 상태 변경만 허용된 관리 권한을 가진다", () => {
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.SYNC_RUN), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CALENDAR_SOURCE_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ADMIN_SETTINGS_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.DEVELOPER_MANAGEMENT_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_MANAGE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_ASSIGN), false);
});
test("Permission Mapping은 모든 Role을 빠짐없이 정의한다", () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...USER_ROLES].sort());
});
test("잘못된 Role과 production fallback은 안전하게 거부한다", () => {
  assert.equal(resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "OWNER" }), null);
  assert.equal(resolveDevelopmentAccessContext({ NODE_ENV: "production", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "DEVELOPER" }), null);
});
test("ADMIN과 STAFF 개발 접근은 Company 범위가 없으면 거부한다", () => {
  assert.equal(resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "ADMIN" }), null);
  const context = resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "STAFF", STAYBOARD_DEV_ACCESS_COMPANY_IDS: "company-a, company-a" });
  assert.deepEqual(context?.scope, { mode: "companies", companyIds: ["company-a"] });
});
test("개발 접근은 명시한 사용자 ID를 Preference 식별자로 유지한다", () => {
  const context = resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "DEVELOPER", STAYBOARD_DEV_ACCESS_USER_ID: "developer-a" });
  assert.equal(context?.userId, "developer-a");
});
test("STAFF는 배정된 숙소 또는 객실만 접근한다", () => {
  const context: AccessContext = { userId: "staff", actualRole: "STAFF", previewRole: null, effectiveRole: "STAFF", role: "STAFF", systemRole: "NONE", companyRole: "STAFF", scope: { mode: "companies", companyIds: ["company-a"], propertyIds: ["property-a"], roomIds: ["room-b"] }, source: "session" };
  assert.equal(canAccessCompany(context, "company-a"), true);
  assert.equal(canAccessCompany(context, "company-b"), false);
  assert.equal(canAccessRoom(context, { id: "room-a", propertyId: "property-a" }), true);
  assert.equal(canAccessRoom(context, { id: "room-b", propertyId: "property-b" }), true);
  assert.equal(canAccessRoom(context, { id: "room-c", propertyId: "property-b" }), false);
});

const previewEnvironment = { NODE_ENV: "production", ENABLE_ROLE_PREVIEW: "true" };

test("role preview keeps the actual DEVELOPER while applying ADMIN or STAFF permissions", () => {
  const admin = getAuthorizationRoles(previewEnvironment, "DEVELOPER", "ADMIN", true);
  const staff = getAuthorizationRoles(previewEnvironment, "DEVELOPER", "STAFF", true);
  assert.deepEqual(admin, { actualRole: "DEVELOPER", previewRole: "ADMIN", effectiveRole: "ADMIN" });
  assert.deepEqual(staff, { actualRole: "DEVELOPER", previewRole: "STAFF", effectiveRole: "STAFF" });
  assert.equal(isRolePreviewActive(admin), true);
  assert.equal(hasPermission(admin.effectiveRole, PERMISSIONS.ADMIN_SETTINGS_READ), true);
  assert.equal(hasPermission(staff.effectiveRole, PERMISSIONS.ADMIN_SETTINGS_READ), false);
  assert.equal(hasPermission(staff.effectiveRole, PERMISSIONS.USER_MANAGE), false);
});

test("ordinary ADMIN and STAFF accounts cannot use role preview", () => {
  assert.equal(canUseRolePreview(previewEnvironment, "ADMIN"), false);
  assert.equal(canUseRolePreview(previewEnvironment, "STAFF"), false);
  assert.equal(getPreviewRole(previewEnvironment, "ADMIN", "STAFF", true), null);
});

test("production enables role preview only with the explicit server flag", () => {
  assert.deepEqual(
    getAuthorizationRoles({ NODE_ENV: "production", ENABLE_ROLE_PREVIEW: "true" }, "DEVELOPER", "ADMIN", true),
    { actualRole: "DEVELOPER", previewRole: "ADMIN", effectiveRole: "ADMIN" },
  );
  assert.equal(canUseRolePreview({ NODE_ENV: "production", ENABLE_ROLE_PREVIEW: "true" }, "DEVELOPER"), true);
});

test("missing or disabled role preview flags ignore preview cookies in every environment", () => {
  assert.deepEqual(
    getAuthorizationRoles({ NODE_ENV: "development", ENABLE_ROLE_PREVIEW: "false" }, "DEVELOPER", "STAFF", true),
    { actualRole: "DEVELOPER", previewRole: null, effectiveRole: "DEVELOPER" },
  );
  assert.deepEqual(
    getAuthorizationRoles({ NODE_ENV: "production" }, "DEVELOPER", "ADMIN", true),
    { actualRole: "DEVELOPER", previewRole: null, effectiveRole: "DEVELOPER" },
  );
});

test("tampered cookies and previews without an active company are ignored", () => {
  assert.equal(getPreviewRole(previewEnvironment, "DEVELOPER", "OWNER", true), null);
  assert.equal(getPreviewRole(previewEnvironment, "DEVELOPER", "ADMIN", false), null);
  assert.equal(getPreviewRole(previewEnvironment, "DEVELOPER", "STAFF", false), null);
});

test("ending role preview restores the DEVELOPER effective role", () => {
  const ended = getAuthorizationRoles(previewEnvironment, "DEVELOPER", null, true);
  assert.deepEqual(ended, { actualRole: "DEVELOPER", previewRole: null, effectiveRole: "DEVELOPER" });
  assert.equal(isRolePreviewActive(ended), false);
});

test("role preview uses a server-only HttpOnly cookie with the shared base path", () => {
  const actionSource = readFileSync("src/features/access-control/role-preview.actions.ts", "utf8");
  assert.match(actionSource, /"use server"/);
  assert.match(actionSource, /import "server-only"/);
  assert.match(actionSource, /httpOnly: true/);
  assert.match(actionSource, /sameSite: "lax"/);
  assert.match(actionSource, /path: AUTH_COOKIE_PATH/);
  assert.match(actionSource, /ROLE_PREVIEW_MAX_AGE_SECONDS/);
});

test("dangerous account, member, invitation, company, and developer preference writes are preview-guarded", () => {
  for (const path of [
    "src/features/user-management/user-management.actions.ts",
    "src/features/member-management/member-management.actions.ts",
    "src/features/invitation-codes/invitation-code.actions.ts",
    "src/features/companies/company.actions.ts",
    "src/features/sidebar-preferences/sidebar-preference.actions.ts",
  ]) {
    assert.match(readFileSync(path, "utf8"), /getRolePreviewWriteBlock/);
  }
});
