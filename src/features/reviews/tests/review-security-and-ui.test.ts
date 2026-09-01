import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import { DEFAULT_SIDEBAR_PREFERENCE, getAuthorizedSidebarMenus } from "../../sidebar-preferences/domain/sidebar-preference";
import { SIDEBAR_MENU_ITEMS } from "../../sidebar-preferences/domain/sidebar-menu";
import { isPrivateNetworkAddress } from "../../../lib/network-safety";

test("DEVELOPER와 ADMIN만 리뷰 메뉴 및 조회·새로고침 권한을 가진다", () => {
  for (const role of ["DEVELOPER", "ADMIN"] as const) {
    assert.equal(hasPermission(role, PERMISSIONS.PROPERTY_REVIEW_READ), true);
    assert.equal(hasPermission(role, PERMISSIONS.PROPERTY_REVIEW_SYNC), true);
    assert.equal(getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, DEFAULT_SIDEBAR_PREFERENCE, role).some((item) => item.id === "property-reviews"), true);
  }
  assert.equal(hasPermission("STAFF", PERMISSIONS.PROPERTY_REVIEW_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.PROPERTY_REVIEW_SYNC), false);
  assert.equal(getAuthorizedSidebarMenus(SIDEBAR_MENU_ITEMS, DEFAULT_SIDEBAR_PREFERENCE, "STAFF").some((item) => item.id === "property-reviews"), false);
});

test("리뷰 페이지, Server Action, repository가 각각 권한을 검사한다", () => {
  const page = readFileSync("src/app/property-reviews/page.tsx", "utf8");
  const action = readFileSync("src/features/reviews/review.actions.ts", "utf8");
  const repository = readFileSync("src/features/reviews/server/review.repository.ts", "utf8");
  assert.match(page, /authorizeAccess\(PERMISSIONS\.PROPERTY_REVIEW_READ\)/);
  assert.match(action, /requirePermission\(PERMISSIONS\.PROPERTY_REVIEW_SYNC\)/);
  assert.match(repository, /hasPermission\(context\.role, PERMISSIONS\.PROPERTY_REVIEW_READ\)/);
  assert.match(repository, /hasPermission\(context\.role, PERMISSIONS\.PROPERTY_REVIEW_SYNC\)/);
  assert.match(repository, /roomScopeWhere\(context\.scope\)/);
});

test("수동 수집은 SSRF, redirect 재검증, 동시성 제한과 중복 잠금을 사용한다", () => {
  assert.equal(isPrivateNetworkAddress("127.0.0.1"), true);
  assert.equal(isPrivateNetworkAddress("169.254.169.254"), true);
  assert.equal(isPrivateNetworkAddress("10.0.0.1"), true);
  assert.equal(isPrivateNetworkAddress("::1"), true);
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
  const fetcher = readFileSync("src/features/reviews/providers/review-page-fetcher.ts", "utf8");
  const service = readFileSync("src/features/reviews/server/review-sync.service.ts", "utf8");
  assert.match(fetcher, /redirect: "manual"/);
  assert.match(fetcher, /isAllowedListingHostname\(input\.provider, current\.hostname\)/);
  assert.match(fetcher, /assertSafePublicHttpsUrl\(current, signal\)/);
  assert.match(service, /withPostgresAdvisoryLocks/);
  assert.match(service, /runIsolatedReviewSyncBatch/);
  assert.doesNotMatch(service, /listingReview\.delete|reviewSnapshot\.delete/);
});

test("리뷰 목록은 데스크톱 테이블과 모바일 카드, Light/Dark 오류 스타일을 제공한다", () => {
  const list = readFileSync("src/features/reviews/components/review-room-list.tsx", "utf8");
  const status = readFileSync("src/features/reviews/components/review-summary-status.tsx", "utf8");
  const detail = readFileSync("src/features/reviews/components/review-room-detail.tsx", "utf8");
  const messages = readFileSync("src/messages/ko.json", "utf8");
  assert.match(list, /md:hidden/);
  assert.match(list, /hidden overflow-hidden md:block/);
  assert.match(messages, /등록된 숙소 링크가 없습니다/);
  assert.match(messages, /아직 리뷰 정보를 불러오지 않았습니다/);
  assert.match(status, /dark:text-amber-300/);
  assert.match(detail, /reviews\.states\.preservedAfterFailure/);
});
