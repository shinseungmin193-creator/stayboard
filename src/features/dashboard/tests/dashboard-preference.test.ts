import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canManageStaffMobileDashboardPreference,
  DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE,
  getVisibleStaffMobileDashboardCardIds,
  normalizeStaffMobileDashboardPreference,
  validateStaffMobileDashboardPreference,
} from "../../dashboard-preferences/domain/dashboard-preference";

test("저장값이 없으면 STAFF 모바일 기본 6개 카드를 사용한다", () => {
  assert.deepEqual(normalizeStaffMobileDashboardPreference(null), {
    cardOrder: ["today-check-in", "today-check-out", "overbooking", "priority-cleaning", "flexible-cleaning", "cleaning-management"],
    hiddenCardIds: [],
  });
});

test("저장 순서와 숨김 설정을 모바일 노출 카드에 적용한다", () => {
  assert.deepEqual(getVisibleStaffMobileDashboardCardIds({
    cardOrder: ["cleaning-management", "today-check-in", "today-check-out", "overbooking", "priority-cleaning", "flexible-cleaning"],
    hiddenCardIds: ["overbooking", "flexible-cleaning"],
  }), ["cleaning-management", "today-check-in", "today-check-out", "priority-cleaning"]);
});

test("삭제되거나 알 수 없는 ID는 버리고 누락된 신규 카드는 기본 순서로 보충한다", () => {
  assert.deepEqual(normalizeStaffMobileDashboardPreference({
    cardOrder: ["priority-cleaning", "removed-card", "priority-cleaning"],
    hiddenCardIds: ["removed-card"],
  }), {
    cardOrder: ["priority-cleaning", "today-check-in", "today-check-out", "overbooking", "flexible-cleaning", "cleaning-management"],
    hiddenCardIds: [],
  });
});

test("모든 카드를 숨긴 손상 데이터는 안전한 기본값으로 복구한다", () => {
  const allHidden = [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder];
  assert.deepEqual(normalizeStaffMobileDashboardPreference({ cardOrder: allHidden, hiddenCardIds: allHidden }), DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE);
});

test("저장 입력은 전체 허용 ID, 중복 없음, 최소 한 개 노출을 강제한다", () => {
  assert.equal(validateStaffMobileDashboardPreference(DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE), true);
  assert.equal(validateStaffMobileDashboardPreference({ cardOrder: ["today-check-in"], hiddenCardIds: [] }), false);
  assert.equal(validateStaffMobileDashboardPreference({ cardOrder: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder], hiddenCardIds: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder] }), false);
  assert.equal(validateStaffMobileDashboardPreference({ cardOrder: ["today-check-in", "today-check-in", "overbooking", "priority-cleaning", "flexible-cleaning", "cleaning-management"], hiddenCardIds: [] }), false);
  assert.equal(validateStaffMobileDashboardPreference({ cardOrder: [...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder, "sync-failure"], hiddenCardIds: [] }), false);
  assert.equal(validateStaffMobileDashboardPreference({ cardOrder: ["unknown-card", ...DEFAULT_STAFF_MOBILE_DASHBOARD_PREFERENCE.cardOrder.slice(1)], hiddenCardIds: [] }), false);
});

test("설정 변경은 역할 전환이 없는 실제 DEVELOPER만 가능하다", () => {
  assert.equal(canManageStaffMobileDashboardPreference({ actualRole: "DEVELOPER", effectiveRole: "DEVELOPER", isRoleSwitchActive: false }), true);
  assert.equal(canManageStaffMobileDashboardPreference({ actualRole: "DEVELOPER", effectiveRole: "STAFF", isRoleSwitchActive: true }), false);
  assert.equal(canManageStaffMobileDashboardPreference({ actualRole: "ADMIN", effectiveRole: "ADMIN", isRoleSwitchActive: false }), false);
  assert.equal(canManageStaffMobileDashboardPreference({ actualRole: "STAFF", effectiveRole: "STAFF", isRoleSwitchActive: false }), false);
});

test("DB와 서비스는 회사별 STAFF MOBILE 설정 및 감사 로그를 강제한다", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const migration = readFileSync("prisma/migrations/20260803120000_add_dashboard_role_preferences/migration.sql", "utf8");
  const service = readFileSync("src/features/dashboard-preferences/server/dashboard-preference.service.ts", "utf8");
  assert.match(schema, /@@unique\(\[companyId, role, viewport\]\)/);
  assert.match(migration, /CREATE TYPE "DashboardViewport" AS ENUM \('MOBILE', 'DESKTOP'\)/);
  assert.match(service, /role: "STAFF", viewport: "MOBILE"/);
  assert.match(service, /STAFF_MOBILE_DASHBOARD_PREFERENCE_UPDATED/);
  assert.match(service, /STAFF_MOBILE_DASHBOARD_PREFERENCE_RESET/);
  assert.match(service, /availableCompanies\?\.some/);
});

test("대시보드는 effective STAFF의 모바일에서만 회사 설정을 적용한다", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.match(page, /dashboardRole === "STAFF" && context\?\.activeCompanyId/);
  assert.match(page, /getStaffMobileDashboardPreference\(context\.activeCompanyId\)/);
  assert.match(page, /className="grid grid-cols-2 gap-2 sm:gap-3 lg:hidden"/);
  assert.match(page, /className="hidden gap-3 lg:grid lg:grid-cols-3"/);
});

test("설정 UI는 모바일 버전 영역 안에서 디버그보다 먼저 렌더링되고 한일 번역을 제공한다", () => {
  const form = readFileSync("src/features/developer-settings/components/developer-settings-form.tsx", "utf8");
  const ko = JSON.parse(readFileSync("src/messages/ko.json", "utf8"));
  const ja = JSON.parse(readFileSync("src/messages/ja.json", "utf8"));
  assert.ok(form.indexOf("StaffMobileDashboardPreferenceEditor") < form.indexOf("technical.debugMode"));
  assert.equal(ko.dashboardPreferences.title, "직원 모바일 홈 화면 설정");
  assert.equal(ja.dashboardPreferences.title, "スタッフのモバイルホーム画面設定");
});
