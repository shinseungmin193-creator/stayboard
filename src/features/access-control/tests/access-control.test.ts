import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessCompany,
  canAccessRoom,
  hasPermission,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  USER_ROLES,
  withAccessAuditMetadata,
  type AccessContext,
} from "../domain/access-control";
import { resolveDevelopmentAccessContext } from "../domain/development-access-policy";

test("DEVELOPER has every centrally defined permission", () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(hasPermission("DEVELOPER", permission), true);
  }
});

test("ADMIN has admin permissions but no developer permissions", () => {
  assert.equal(hasPermission("ADMIN", PERMISSIONS.ADMIN_SETTINGS_MANAGE), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_SETTINGS_READ), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_MANAGEMENT_READ), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.DEVELOPER_MANAGEMENT_MANAGE), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.PROPERTY_REVIEW_READ), true);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.PROPERTY_REVIEW_SYNC), true);
});

test("STAFF has operational permissions only", () => {
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_MANAGE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_WORKER_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_WORKER_CREATE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_WORKER_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.STATISTICS_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_NOTE_READ), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_NOTE_CREATE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_NOTE_COMPLETE), true);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_NOTE_DELETE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CALENDAR_SOURCE_MANAGE), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.ADMIN_SETTINGS_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.CLEANING_ASSIGN), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.PROPERTY_REVIEW_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.PROPERTY_REVIEW_SYNC), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.CLEANING_WORKER_MANAGE), true);
});

test("ADMIN과 DEVELOPER만 객실 메모 삭제 권한을 가진다", () => {
  assert.equal(hasPermission("STAFF", PERMISSIONS.ROOM_NOTE_DELETE), false);
  assert.equal(hasPermission("ADMIN", PERMISSIONS.ROOM_NOTE_DELETE), true);
  assert.equal(hasPermission("DEVELOPER", PERMISSIONS.ROOM_NOTE_DELETE), true);
});

test("permission mapping covers every role", () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), [...USER_ROLES].sort());
});

test("development bootstrap rejects invalid roles and production", () => {
  assert.equal(resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "OWNER" }), null);
  assert.equal(resolveDevelopmentAccessContext({ NODE_ENV: "production", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "DEVELOPER" }), null);
});

test("ADMIN and STAFF development access requires a company scope", () => {
  assert.equal(resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "ADMIN" }), null);
  const context = resolveDevelopmentAccessContext({ NODE_ENV: "development", STAYBOARD_DEV_ACCESS_ENABLED: "true", STAYBOARD_DEV_ACCESS_ROLE: "STAFF", STAYBOARD_DEV_ACCESS_COMPANY_IDS: "company-a, company-a" });
  assert.deepEqual(context?.scope, { mode: "companies", companyIds: ["company-a"] });
});

test("STAFF can access only assigned property or room scope", () => {
  const context: AccessContext = {
    userId: "staff",
    actualRole: "STAFF",
    previewRole: null,
    effectiveRole: "STAFF",
    isRoleSwitchActive: false,
    role: "STAFF",
    systemRole: "NONE",
    companyRole: "STAFF",
    allowedCompanyIds: ["company-a"],
    allowedPropertyIds: ["property-a"],
    developerRoleSessionId: null,
    scope: { mode: "companies", companyIds: ["company-a"], propertyIds: ["property-a"], roomIds: ["room-b"] },
    source: "session",
  };
  assert.equal(canAccessCompany(context, "company-a"), true);
  assert.equal(canAccessCompany(context, "company-b"), false);
  assert.equal(canAccessRoom(context, { id: "room-a", propertyId: "property-a" }), true);
  assert.equal(canAccessRoom(context, { id: "room-b", propertyId: "property-b" }), true);
  assert.equal(canAccessRoom(context, { id: "room-c", propertyId: "property-b" }), false);
});

test("role switch audit metadata is emitted only for an active switch", () => {
  const switched: AccessContext = {
    userId: "developer",
    actualRole: "DEVELOPER",
    previewRole: "STAFF",
    effectiveRole: "STAFF",
    isRoleSwitchActive: true,
    role: "STAFF",
    systemRole: "DEVELOPER",
    companyRole: "STAFF",
    allowedCompanyIds: ["company-a"],
    allowedPropertyIds: ["property-a"],
    developerRoleSessionId: "switch-session",
    scope: { mode: "companies", companyIds: ["company-a"], propertyIds: ["property-a"] },
    source: "session",
  };
  assert.deepEqual(withAccessAuditMetadata(switched, { change: "done" }), {
    change: "done",
    actualRole: "DEVELOPER",
    effectiveRole: "STAFF",
    developerRoleSessionId: "switch-session",
  });
  assert.equal(hasPermission(switched.effectiveRole, PERMISSIONS.ADMIN_SETTINGS_MANAGE), false);
  assert.equal(hasPermission(switched.effectiveRole, PERMISSIONS.DEVELOPER_SETTINGS_READ), false);
});
