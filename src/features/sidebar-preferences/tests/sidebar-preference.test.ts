import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SIDEBAR_PREFERENCE, getAuthorizedSidebarMenus, getSidebarMenuLabel, moveSidebarMenu, normalizeSidebarPreference, orderSidebarMenus } from "../domain/sidebar-preference";
import { DEFAULT_SIDEBAR_MENU_ORDER, SIDEBAR_MENU_ITEMS } from "../domain/sidebar-menu";

test("기본 Sidebar 순서는 메뉴 정의 순서를 따른다", () => {
  assert.deepEqual(DEFAULT_SIDEBAR_PREFERENCE.menuOrder, DEFAULT_SIDEBAR_MENU_ORDER);
});

test("기존 Preference에 없는 신규 메뉴는 마지막에 자동 추가한다", () => {
  const normalized = normalizeSidebarPreference({ menuOrder: ["rooms", "dashboard"], hiddenMenuIds: [] });
  assert.deepEqual(normalized.menuOrder.slice(0, 2), ["rooms", "dashboard"]);
  assert.equal(normalized.menuOrder.length, SIDEBAR_MENU_ITEMS.length);
  assert.equal(new Set(normalized.menuOrder).size, SIDEBAR_MENU_ITEMS.length);
});

test("중복·알 수 없는 메뉴를 제거하고 필수 설정 메뉴는 숨기지 않는다", () => {
  const normalized = normalizeSidebarPreference({
    menuOrder: ["dashboard", "dashboard", "unknown"],
    hiddenMenuIds: ["dashboard", "admin-settings", "developer-settings", "unknown"],
  });
  assert.deepEqual(normalized.hiddenMenuIds, ["dashboard"]);
  assert.equal(normalized.menuOrder.filter((menuId) => menuId === "dashboard").length, 1);
});

test("Sidebar 메뉴는 저장된 전역 순서로 정렬한다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: ["rooms", "dashboard"], hiddenMenuIds: [] });
  const ordered = orderSidebarMenus(SIDEBAR_MENU_ITEMS, preference);
  assert.deepEqual(ordered.slice(0, 2).map((menu) => menu.id), ["rooms", "dashboard"]);
});

test("드래그 순서는 즉시 배열에 반영되고 고정 메뉴 위치는 유지한다", () => {
  const initial = [...DEFAULT_SIDEBAR_MENU_ORDER];
  const lockedPositions = initial
    .map((menuId, index) => ({ menuId, index }))
    .filter(({ menuId }) => ["admin-settings", "developer-settings", "developer-error-logs"].includes(menuId));
  const moved = moveSidebarMenu(initial, "dashboard", "occupancy-statistics");

  assert.ok(moved.indexOf("dashboard") > moved.indexOf("calendar-sources"));
  assert.equal(moved.length, SIDEBAR_MENU_ITEMS.length);
  for (const { menuId, index } of lockedPositions) assert.equal(moved[index], menuId);
});

test("고정 메뉴 자체를 드래그하면 순서가 바뀌지 않는다", () => {
  const initial = [...DEFAULT_SIDEBAR_MENU_ORDER];
  assert.deepEqual(moveSidebarMenu(initial, "admin-settings", "dashboard"), initial);
});

test("역할 권한과 사용자 숨김 설정을 순서 설정에 함께 적용한다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: ["developer-settings", "room-overview", "dashboard"], hiddenMenuIds: ["dashboard"] });
  const staff = getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, preference, "STAFF");
  assert.equal(staff.some((item) => item.id === "developer-settings"), false);
  assert.equal(staff.some((item) => item.id === "properties"), false);
  assert.equal(staff.some((item) => item.id === "dashboard"), false);
  assert.equal(staff.some((item) => item.id === "room-overview"), true);
  const developer = getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, DEFAULT_SIDEBAR_PREFERENCE, "DEVELOPER");
  assert.equal(developer.some((item) => item.id === "developer-settings"), true);
  const admin = getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, DEFAULT_SIDEBAR_PREFERENCE, "ADMIN");
  assert.equal(admin.some((item) => item.id === "member-management"), true);
  assert.equal(admin.some((item) => item.id === "admin-settings"), true);
  assert.equal(admin.some((item) => item.id === "developer-settings"), false);
  assert.equal(staff.some((item) => item.id === "member-management"), false);
  assert.equal(staff.some((item) => item.id === "admin-settings"), false);
});

test("사용자 지정 이름은 메뉴 ID별로 정규화하고 기본 정의는 변경하지 않는다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: [], hiddenMenuIds: [], customLabels: { dashboard: "  운영 홈  ", reservations: "예약", unknown: "무시", rooms: "" } });
  assert.equal(getSidebarMenuLabel(SIDEBAR_MENU_ITEMS[0], preference), "운영 홈");
  assert.equal(preference.customLabels.reservations, undefined);
  assert.equal(preference.customLabels.rooms, undefined);
  assert.equal(SIDEBAR_MENU_ITEMS[0].label, "대시보드");
});

test("잠긴 메뉴도 사용자 지정 이름을 사용할 수 있다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: [], hiddenMenuIds: [], customLabels: { "admin-settings": "관리 설정", "developer-settings": "개발 도구" } });
  const admin = SIDEBAR_MENU_ITEMS.find((menu) => menu.id === "admin-settings");
  const developer = SIDEBAR_MENU_ITEMS.find((menu) => menu.id === "developer-settings");
  assert.ok(admin && developer);
  assert.equal(getSidebarMenuLabel(admin, preference), "관리 설정");
  assert.equal(getSidebarMenuLabel(developer, preference), "개발 도구");
});

test("빈 이름과 20자 초과 이름은 저장값에서 제거한다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: [], hiddenMenuIds: [], customLabels: { dashboard: "   ", rooms: "가".repeat(21) } });
  assert.deepEqual(preference.customLabels, {});
});

test("customLabels가 없거나 잘못된 기존 값이면 빈 객체로 복원한다", () => {
  assert.deepEqual(normalizeSidebarPreference(undefined).customLabels, {});
  assert.deepEqual(normalizeSidebarPreference({ customLabels: null }).customLabels, {});
  assert.deepEqual(normalizeSidebarPreference({ customLabels: [] }).customLabels, {});
  assert.deepEqual(normalizeSidebarPreference({ customLabels: "invalid" }).customLabels, {});
});
