import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canManageStaffMobileNavigationPreference,
  DEFAULT_STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
  normalizeStaffMobileNavigationPreference,
  STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
  validateStaffMobileNavigationPreference,
} from "../domain/mobile-navigation-preference";

test("STAFF 하단 내비게이션 기본값은 기존 4개 메뉴 순서다", () => {
  assert.deepEqual(DEFAULT_STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS, ["dashboard", "room-overview", "reservations", "room-status"]);
  assert.deepEqual(normalizeStaffMobileNavigationPreference(null), { itemOrder: ["dashboard", "room-overview", "reservations", "room-status"] });
});

test("저장 순서를 유지하고 중복·알 수 없는 ID는 기본 메뉴로 보완한다", () => {
  assert.deepEqual(normalizeStaffMobileNavigationPreference({ itemOrder: ["cleaning", "cleaning", "unknown", "dashboard"] }), {
    itemOrder: ["cleaning", "dashboard", "room-overview", "reservations"],
  });
});

test("정확히 4개의 서로 다른 STAFF 허용 메뉴만 저장한다", () => {
  assert.equal(validateStaffMobileNavigationPreference({ itemOrder: ["cleaning", "dashboard", "reservations", "room-status"] }), true);
  assert.equal(validateStaffMobileNavigationPreference({ itemOrder: ["dashboard", "room-overview", "reservations"] }), false);
  assert.equal(validateStaffMobileNavigationPreference({ itemOrder: ["dashboard", "dashboard", "reservations", "room-status"] }), false);
  assert.equal(validateStaffMobileNavigationPreference({ itemOrder: ["dashboard", "room-overview", "reservations", "developer-settings"] }), false);
});

test("후보 메뉴는 중앙 권한 정책에서 STAFF가 접근 가능한 메뉴로 만든다", () => {
  assert.ok(STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS.includes("cleaning"));
  assert.ok(STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS.includes("occupancy-statistics"));
  assert.ok(!STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS.includes("admin-settings"));
  assert.ok(!STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS.includes("developer-settings"));
});

test("설정 변경은 권한 전환 중이 아닌 실제 DEVELOPER만 가능하다", () => {
  assert.equal(canManageStaffMobileNavigationPreference({ actualRole: "DEVELOPER", effectiveRole: "DEVELOPER", isRoleSwitchActive: false }), true);
  assert.equal(canManageStaffMobileNavigationPreference({ actualRole: "DEVELOPER", effectiveRole: "STAFF", isRoleSwitchActive: true }), false);
  assert.equal(canManageStaffMobileNavigationPreference({ actualRole: "ADMIN", effectiveRole: "ADMIN", isRoleSwitchActive: false }), false);
  assert.equal(canManageStaffMobileNavigationPreference({ actualRole: "STAFF", effectiveRole: "STAFF", isRoleSwitchActive: false }), false);
});

test("후속 migration은 적용된 잘못된 migration을 보존하고 새 테이블로 교체한다", () => {
  const oldMigration = readFileSync("prisma/migrations/20260803120000_add_dashboard_role_preferences/migration.sql", "utf8");
  const replacement = readFileSync("prisma/migrations/20260803230000_replace_dashboard_preferences_with_mobile_navigation/migration.sql", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  assert.match(oldMigration, /CREATE TABLE "DashboardRolePreference"/);
  assert.match(replacement, /DROP TABLE "DashboardRolePreference"/);
  assert.match(replacement, /CREATE TABLE "MobileNavigationPreference"/);
  assert.doesNotMatch(replacement, /INSERT INTO|cardOrder/);
  assert.match(schema, /@@unique\(\[companyId, role\]\)/);
  assert.doesNotMatch(schema, /DashboardRolePreference|DashboardViewport/);
});

test("서비스는 회사별 STAFF 설정과 변경·초기화 감사 로그를 사용한다", () => {
  const service = readFileSync("src/features/mobile-navigation-preferences/server/mobile-navigation-preference.service.ts", "utf8");
  assert.match(service, /companyId_role: \{ companyId, role: "STAFF" \}/);
  assert.match(service, /context\.activeCompanyId === companyId/);
  assert.match(service, /context\.allowedCompanyIds\?\.includes\(companyId\)/);
  assert.match(service, /PERMISSIONS\.DEVELOPER_SETTINGS_READ/);
  assert.match(service, /availableCompanies\?\.some/);
  assert.match(service, /STAFF_MOBILE_NAVIGATION_PREFERENCE_UPDATED/);
  assert.match(service, /STAFF_MOBILE_NAVIGATION_PREFERENCE_RESET/);
});

test("AppShell은 effective STAFF 회사 설정만 조회해 모바일 내비게이션에 전달한다", () => {
  const shell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const navigation = readFileSync("src/components/layout/mobile-navigation.tsx", "utf8");
  assert.match(shell, /accessContext\?\.effectiveRole === "STAFF" && accessContext\.activeCompanyId/);
  assert.match(shell, /getStaffMobileNavigationPreference\(accessContext\.activeCompanyId\)/);
  assert.match(shell, /<MobileNavigation role=\{accessContext\?\.effectiveRole \?\? null\}/);
  assert.match(navigation, /role === "STAFF" && staffPrimaryMenuIds\?\.length === 4/);
  assert.match(navigation, /primaryItems\.slice\(0, 4\)/);
  assert.match(navigation, /<MoreHorizontal/);
});

test("대시보드 카드는 회사별 모바일 설정 없이 기존 역할 정책을 유지한다", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const policy = readFileSync("src/features/dashboard/dashboard-card-policy.ts", "utf8");
  assert.doesNotMatch(page, /MobileDashboard|staffMobileDashboard|getStaffMobileDashboard/);
  assert.match(page, /dashboardCards = getDashboardCardIds\(dashboardRole\)/);
  assert.match(policy, /"cleaning-management"/);
  assert.match(policy, /hasPermission\(role, PERMISSIONS\.SYNC_READ\)/);
});

test("개발자 설정 모바일 버전 영역과 한일 번역이 하단 내비게이션을 명시한다", () => {
  const form = readFileSync("src/features/developer-settings/components/developer-settings-form.tsx", "utf8");
  const ko = JSON.parse(readFileSync("src/messages/ko.json", "utf8"));
  const ja = JSON.parse(readFileSync("src/messages/ja.json", "utf8"));
  assert.match(form, /StaffMobileNavigationPreferenceEditor/);
  assert.doesNotMatch(form, /StaffMobileDashboardPreferenceEditor/);
  assert.equal(ko.mobileNavigationPreferences.title, "직원 모바일 하단 내비게이션 설정");
  assert.equal(ja.mobileNavigationPreferences.title, "スタッフ用モバイル下部ナビゲーション設定");
  assert.equal(ko.dashboardPreferences, undefined);
  assert.equal(ja.dashboardPreferences, undefined);
});
