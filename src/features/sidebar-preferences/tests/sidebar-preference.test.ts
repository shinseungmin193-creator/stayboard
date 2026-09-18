import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  addSidebarDivider,
  canAccessSidebarMenu,
  DEFAULT_SIDEBAR_ITEM_ORDER,
  DEFAULT_SIDEBAR_PREFERENCE,
  getAuthorizedSidebarItems,
  getAuthorizedSidebarMenus,
  getSidebarMenuLabel,
  getSidebarNavigationItems,
  isSidebarPermissionAllowed,
  moveSidebarItem,
  normalizeSidebarPreference,
  orderSidebarMenus,
  removeSidebarDivider,
  type SidebarOrderItem,
} from "../domain/sidebar-preference";
import { PERMISSIONS } from "../../access-control/domain/access-control";
import { SIDEBAR_MENU_ITEMS } from "../domain/sidebar-menu";

const menuKeys = (items: readonly SidebarOrderItem[]) => items.flatMap((item) => item.type === "MENU" ? [item.key] : []);
const navigationTypes = (items: ReturnType<typeof getSidebarNavigationItems>) => items.map((item) => item.type);

test("기본 Sidebar 설정은 실제 메뉴와 기본 구분선을 모두 포함한다", () => {
  assert.deepEqual(DEFAULT_SIDEBAR_PREFERENCE.menuOrder, DEFAULT_SIDEBAR_ITEM_ORDER);
  assert.equal(menuKeys(DEFAULT_SIDEBAR_PREFERENCE.menuOrder).length, SIDEBAR_MENU_ITEMS.length);
  assert.equal(DEFAULT_SIDEBAR_PREFERENCE.menuOrder.filter((item) => item.type === "DIVIDER").length, 3);
});

test("기존 문자열 메뉴 순서는 보존하고 이전 category 경계는 divider로 자동 변환한다", () => {
  const normalized = normalizeSidebarPreference({ menuOrder: ["rooms", "dashboard"], hiddenMenuIds: [] });
  assert.deepEqual(menuKeys(normalized.menuOrder).slice(0, 2), ["rooms", "dashboard"]);
  assert.equal(menuKeys(normalized.menuOrder).length, SIDEBAR_MENU_ITEMS.length);
  assert.ok(normalized.menuOrder.some((item) => item.type === "DIVIDER" && item.id.startsWith("divider:legacy-")));
});

test("중복·알 수 없는 메뉴를 제거하고 필수 설정 메뉴는 숨기지 않는다", () => {
  const normalized = normalizeSidebarPreference({
    menuOrder: ["dashboard", "dashboard", "unknown"],
    hiddenMenuIds: ["dashboard", "admin-settings", "developer-settings", "unknown"],
  });
  assert.deepEqual(normalized.hiddenMenuIds, ["dashboard"]);
  assert.equal(menuKeys(normalized.menuOrder).filter((menuId) => menuId === "dashboard").length, 1);
});

test("Sidebar 메뉴는 저장된 전역 순서로 정렬한다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: [{ type: "MENU", key: "rooms" }, { type: "MENU", key: "dashboard" }], hiddenMenuIds: [] });
  const ordered = orderSidebarMenus(SIDEBAR_MENU_ITEMS, preference);
  assert.deepEqual(ordered.slice(0, 2).map((menu) => menu.id), ["rooms", "dashboard"]);
});

test("MENU와 DIVIDER는 같은 배열에서 drag 순서가 변경된다", () => {
  const initial = structuredClone(DEFAULT_SIDEBAR_PREFERENCE.menuOrder);
  const divider = initial.find((item) => item.type === "DIVIDER");
  assert.ok(divider);
  const movedDivider = moveSidebarItem(initial, divider.id, "dashboard");
  assert.equal(movedDivider.findIndex((item) => item.type === "DIVIDER" && item.id === divider.id) + 1, movedDivider.findIndex((item) => item.type === "MENU" && item.key === "dashboard"));
  const movedLockedMenu = moveSidebarItem(initial, "admin-settings", "room-overview");
  assert.equal(menuKeys(movedLockedMenu)[0], "admin-settings");
});

test("구분선을 추가하고 삭제할 수 있다", () => {
  const added = addSidebarDivider(DEFAULT_SIDEBAR_PREFERENCE.menuOrder, "divider:test-add");
  assert.equal(added.filter((item) => item.type === "DIVIDER" && item.id === "divider:test-add").length, 1);
  assert.equal(added.at(-2)?.type, "DIVIDER");
  assert.equal(removeSidebarDivider(added, "divider:test-add").some((item) => item.type === "DIVIDER" && item.id === "divider:test-add"), false);
});

test("권한 필터 뒤 맨 위·맨 아래·연속 divider를 제거한다", () => {
  const preference = normalizeSidebarPreference({
    menuOrder: [
      { type: "DIVIDER", id: "divider:leading" },
      { type: "MENU", key: "room-overview" },
      { type: "DIVIDER", id: "divider:first" },
      { type: "DIVIDER", id: "divider:second" },
      { type: "MENU", key: "dashboard" },
      { type: "DIVIDER", id: "divider:trailing" },
    ],
  });
  const rendered = getSidebarNavigationItems(SIDEBAR_MENU_ITEMS, preference, (menu) => ["room-overview", "dashboard"].includes(menu.id));
  assert.deepEqual(navigationTypes(rendered), ["MENU", "DIVIDER", "MENU"]);
  assert.equal(rendered.find((item) => item.type === "DIVIDER")?.id, "divider:first");
});

test("권한 때문에 divider 앞 메뉴가 사라져도 선행 divider가 남지 않는다", () => {
  const preference = normalizeSidebarPreference({
    menuOrder: [
      { type: "MENU", key: "property-reviews" },
      { type: "DIVIDER", id: "divider:role-filter" },
      { type: "MENU", key: "room-overview" },
    ],
  });
  const staffItems = getAuthorizedSidebarItems(SIDEBAR_MENU_ITEMS, preference, "STAFF");
  assert.equal(staffItems[0]?.type, "MENU");
  assert.equal(staffItems.some((item, index) => item.type === "DIVIDER" && (index === 0 || index === staffItems.length - 1)), false);
});

test("역할 권한과 사용자 숨김 설정을 순서 설정에 함께 적용한다", () => {
  const preference = normalizeSidebarPreference({ menuOrder: ["developer-settings", "room-overview", "dashboard"], hiddenMenuIds: ["dashboard"] });
  const staff = getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, preference, "STAFF");
  assert.equal(staff.some((item) => item.id === "developer-settings"), false);
  assert.equal(staff.some((item) => item.id === "properties"), false);
  assert.equal(staff.some((item) => item.id === "dashboard"), false);
  assert.equal(staff.some((item) => item.id === "room-overview"), true);
  assert.equal(staff.some((item) => item.id === "cleaning"), true);
  assert.equal(staff.some((item) => item.id === "room-notes"), true);
  const developer = getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, DEFAULT_SIDEBAR_PREFERENCE, "DEVELOPER");
  const admin = getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, DEFAULT_SIDEBAR_PREFERENCE, "ADMIN");
  assert.equal(developer.some((item) => item.id === "developer-settings"), true);
  assert.equal(admin.some((item) => item.id === "member-management"), true);
  assert.equal(admin.some((item) => item.id === "admin-settings"), true);
  assert.equal(admin.some((item) => item.id === "developer-settings"), false);
  assert.equal(staff.some((item) => item.id === "member-management"), false);
  assert.equal(staff.some((item) => item.id === "admin-settings"), false);
  assert.equal(staff.some((item) => item.id === "property-reviews"), false);
  assert.equal(admin.some((item) => item.id === "property-reviews"), true);
});

test("기본 순서에서 객실 메모는 업무 구간에 배치된다", () => {
  const keys = menuKeys(DEFAULT_SIDEBAR_PREFERENCE.menuOrder);
  assert.ok(keys.indexOf("cleaning") < keys.indexOf("room-notes"));
  assert.ok(keys.indexOf("room-notes") < keys.indexOf("property-reviews"));
});

test("사용자 지정 이름은 메뉴 ID별로 정규화하고 기본 정의는 변경하지 않는다", () => {
  const preference = normalizeSidebarPreference({ customLabels: { dashboard: "  운영 홈  ", reservations: "예약", unknown: "무시", rooms: "" } });
  const dashboard = SIDEBAR_MENU_ITEMS.find((menu) => menu.id === "dashboard");
  assert.ok(dashboard);
  assert.equal(getSidebarMenuLabel(dashboard, preference), "운영 홈");
  assert.equal(preference.customLabels.reservations, undefined);
  assert.equal(preference.customLabels.rooms, undefined);
  assert.equal(dashboard.label, "대시보드");
});

test("잠긴 메뉴도 사용자 지정 이름을 사용할 수 있다", () => {
  const preference = normalizeSidebarPreference({ customLabels: { "admin-settings": "관리 설정", "developer-settings": "개발 도구" } });
  const admin = SIDEBAR_MENU_ITEMS.find((menu) => menu.id === "admin-settings");
  const developer = SIDEBAR_MENU_ITEMS.find((menu) => menu.id === "developer-settings");
  assert.ok(admin && developer);
  assert.equal(getSidebarMenuLabel(admin, preference), "관리 설정");
  assert.equal(getSidebarMenuLabel(developer, preference), "개발 도구");
});

test("빈 이름과 20자 초과 이름은 저장값에서 제거한다", () => {
  const preference = normalizeSidebarPreference({ customLabels: { dashboard: "   ", rooms: "가".repeat(21) } });
  assert.deepEqual(preference.customLabels, {});
});

test("customLabels가 없거나 잘못된 기존 값이면 빈 객체로 복원한다", () => {
  assert.deepEqual(normalizeSidebarPreference(undefined).customLabels, {});
  assert.deepEqual(normalizeSidebarPreference({ customLabels: null }).customLabels, {});
  assert.deepEqual(normalizeSidebarPreference({ customLabels: [] }).customLabels, {});
  assert.deepEqual(normalizeSidebarPreference({ customLabels: "invalid" }).customLabels, {});
});

test("기존 Permission Map으로 메뉴별 allowedRoles 기본값을 만든다", () => {
  assert.deepEqual(DEFAULT_SIDEBAR_PREFERENCE.allowedRoles["room-overview"], ["DEVELOPER", "ADMIN", "STAFF"]);
  assert.deepEqual(DEFAULT_SIDEBAR_PREFERENCE.allowedRoles["property-reviews"], ["DEVELOPER", "ADMIN"]);
  assert.deepEqual(DEFAULT_SIDEBAR_PREFERENCE.allowedRoles["developer-settings"], ["DEVELOPER"]);
});

test("allowedRoles는 sidebar와 route 공통 판정에 적용된다", () => {
  const preference = normalizeSidebarPreference({ allowedRoles: { "room-overview": ["DEVELOPER", "ADMIN"], "room-status": ["DEVELOPER", "ADMIN", "STAFF"] } });
  assert.equal(canAccessSidebarMenu("STAFF", "room-overview", preference.allowedRoles), false);
  assert.equal(canAccessSidebarMenu("STAFF", "room-status", preference.allowedRoles), true);
  assert.equal(getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, preference, "STAFF").some((menu) => menu.id === "room-overview"), false);
  assert.equal(isSidebarPermissionAllowed("STAFF", PERMISSIONS.ROOM_READ, preference.allowedRoles), true);
});

test("allowedRoles는 기존 시스템 권한을 확장하지 않는다", () => {
  const preference = normalizeSidebarPreference({ allowedRoles: { "property-reviews": ["DEVELOPER", "ADMIN", "STAFF"] } });
  assert.deepEqual(preference.allowedRoles["property-reviews"], ["DEVELOPER", "ADMIN"]);
  assert.equal(canAccessSidebarMenu("STAFF", "property-reviews", preference.allowedRoles), false);
  assert.equal(isSidebarPermissionAllowed("STAFF", PERMISSIONS.PROPERTY_REVIEW_SYNC, preference.allowedRoles), false);
});

test("개발자 핵심 메뉴는 DEVELOPER 권한을 해제할 수 없다", () => {
  const preference = normalizeSidebarPreference({ allowedRoles: { "developer-settings": [], "developer-users": [] } });
  assert.deepEqual(preference.allowedRoles["developer-settings"], ["DEVELOPER"]);
  assert.deepEqual(preference.allowedRoles["developer-users"], ["DEVELOPER"]);
});

test("기본 설정 복원 값에는 유효한 divider와 모든 메뉴가 포함된다", () => {
  const restored = normalizeSidebarPreference(structuredClone(DEFAULT_SIDEBAR_PREFERENCE));
  assert.deepEqual(restored.menuOrder, DEFAULT_SIDEBAR_PREFERENCE.menuOrder);
  assert.equal(new Set(menuKeys(restored.menuOrder)).size, SIDEBAR_MENU_ITEMS.length);
});

test("PC·모바일·권한 테스트 모드는 동일한 allowedRoles와 divider source를 사용한다", () => {
  const shell = readFileSync("src/components/layout/app-shell.tsx", "utf8");
  const desktop = readFileSync("src/components/layout/desktop-sidebar.tsx", "utf8");
  const mobile = readFileSync("src/components/layout/mobile-navigation.tsx", "utf8");
  assert.match(shell, /accessContext\?\.effectiveRole \?\? null/);
  assert.match(desktop, /getAuthorizedSidebarItems\(SIDEBAR_MENU_ITEMS, preference, role\)/);
  assert.match(mobile, /getAuthorizedSidebarItems\(SIDEBAR_MENU_ITEMS, preference, role\)/);
  assert.match(desktop, /role="separator"/);
  assert.match(mobile, /role="separator"/);
  assert.doesNotMatch(desktop, /navigation\.groups/);
  assert.doesNotMatch(mobile, /navigation\.groups/);
});

test("페이지·API·Server Action은 서버에서 메뉴 정책과 개발자 권한을 재검증한다", () => {
  const access = readFileSync("src/features/access-control/application/access-context.ts", "utf8");
  const action = readFileSync("src/features/sidebar-preferences/sidebar-preference.actions.ts", "utf8");
  const reviewPage = readFileSync("src/app/property-reviews/page.tsx", "utf8");
  const reservationApi = readFileSync("src/app/api/reservations/route.ts", "utf8");
  assert.match(access, /isSidebarPermissionAllowed\(context\.role, permission, allowedRoles\)/);
  assert.match(access, /canAccessSidebarMenu\(context\.role, menuId, allowedRoles\)/);
  assert.match(action, /context\.systemRole !== "DEVELOPER"/);
  assert.match(action, /PERMISSIONS\.DEVELOPER_SETTINGS_MANAGE/);
  assert.match(reviewPage, /authorizeSidebarMenuAccess\("property-reviews"\)/);
  assert.match(reservationApi, /authorizeSidebarMenuAccess\("reservations"\)/);
});

test("전역 메뉴 정책 migration과 감사 로그를 유지한다", () => {
  const migration = readFileSync("prisma/migrations/20260918140000_add_sidebar_menu_role_policy/migration.sql", "utf8");
  const repository = readFileSync("src/features/sidebar-preferences/infrastructure/sidebar-preference.repository.ts", "utf8");
  assert.match(migration, /CREATE TABLE "SidebarMenuPolicy"/);
  assert.match(migration, /"allowedRoles" JSONB/);
  assert.match(repository, /SIDEBAR_MENU_ROLE_POLICY_UPDATED/);
  assert.match(repository, /TransactionIsolationLevel\.Serializable/);
});

test("category/group field와 자동 section heading 로직을 사용하지 않는다", () => {
  const menuDomain = readFileSync("src/features/sidebar-preferences/domain/sidebar-menu.ts", "utf8");
  const orderCard = readFileSync("src/features/sidebar-preferences/components/sidebar-menu-order-card.tsx", "utf8");
  assert.doesNotMatch(menuDomain, /SIDEBAR_MENU_GROUPS|group:/);
  assert.doesNotMatch(orderCard, /Badge|menu\.group/);
});
