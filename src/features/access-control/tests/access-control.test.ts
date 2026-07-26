import assert from "node:assert/strict";
import test from "node:test";
import { canAccessCompany, canAccessRoom, hasPermission, PERMISSIONS, ROLE_PERMISSIONS, USER_ROLES, type AccessContext } from "../domain/access-control";
import { resolveDevelopmentAccessContext } from "../domain/development-access-policy";

test("DEVELOPER는 모든 Permission을 허용한다", () => {
  for (const permission of Object.values(PERMISSIONS)) assert.equal(hasPermission("DEVELOPER", permission), true);
});
test("ADMIN은 관리자 설정을 허용하고 개발자 설정을 거부한다", () => {
  assert.equal(hasPermission("ADMIN", PERMISSIONS.ADMIN_SETTINGS_MANAGE), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_SETTINGS_READ), false);
});
test("STAFF는 객실 조회와 운영 상태 변경만 허용된 관리 권한을 가진다", () => {
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.SYNC_RUN), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CALENDAR_SOURCE_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ADMIN_SETTINGS_READ), false);
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
  const context: AccessContext = { userId: "staff", role: "STAFF", systemRole: "NONE", companyRole: "STAFF", scope: { mode: "companies", companyIds: ["company-a"], propertyIds: ["property-a"], roomIds: ["room-b"] }, source: "session" };
  assert.equal(canAccessCompany(context, "company-a"), true);
  assert.equal(canAccessCompany(context, "company-b"), false);
  assert.equal(canAccessRoom(context, { id: "room-a", propertyId: "property-a" }), true);
  assert.equal(canAccessRoom(context, { id: "room-b", propertyId: "property-b" }), true);
  assert.equal(canAccessRoom(context, { id: "room-c", propertyId: "property-b" }), false);
});
