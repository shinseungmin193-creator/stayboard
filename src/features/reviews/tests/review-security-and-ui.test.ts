import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import { DEFAULT_SIDEBAR_PREFERENCE, getAuthorizedSidebarMenus } from "../../sidebar-preferences/domain/sidebar-preference";
import { SIDEBAR_MENU_ITEMS } from "../../sidebar-preferences/domain/sidebar-menu";
import { isPrivateNetworkAddress } from "../../../lib/network-safety";

test("DEVELOPER와 ADMIN만 리뷰 메뉴 및 조회·갱신 권한을 가진다", () => {
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
  assert.match(fetcher, /isAllowedListingPathname\(input\.provider, current\.pathname\)/);
  assert.match(fetcher, /assertSafePublicHttpsUrl\(current, signal\)/);
  assert.match(fetcher, /if \(!response\.ok\)/);
  assert.match(fetcher, /parseProviderReviewPage/);
  assert.match(service, /withPostgresAdvisoryLocks/);
  assert.match(service, /collectReviews\(input:/);
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

test("등록된 플랫폼 셀은 최초·진행·성공·실패 상태별 단건 불러오기 액션을 제공한다", () => {
  const list = readFileSync("src/features/reviews/components/review-room-list.tsx", "utf8");
  const platformCell = readFileSync("src/features/reviews/components/review-platform-cell.tsx", "utf8");
  const status = readFileSync("src/features/reviews/components/review-summary-status.tsx", "utf8");
  const button = readFileSync("src/features/reviews/components/review-collect-button.tsx", "utf8");
  const action = readFileSync("src/features/reviews/review.actions.ts", "utf8");
  const repository = readFileSync("src/features/reviews/server/review.repository.ts", "utf8");
  const messages = readFileSync("src/messages/ko.json", "utf8");

  assert.match(list, /ReviewPlatformCell[\s\S]*roomId=\{room\.id\}/);
  assert.match(platformCell, /if \(listing\) return <ReviewSummaryStatus/);
  assert.match(status, /ReviewCollectButton roomId=\{roomId\} provider=\{listing\.provider\} state=\{state\}/);
  assert.match(button, /collectReviewsAction\(\{ roomId, provider \}\)/);
  assert.match(button, /disabled=\{collecting\}/);
  assert.match(button, /LoaderCircle className="animate-spin"/);
  assert.match(action, /findReviewSyncTarget\(context, parsed\.data\)/);
  assert.match(action, /collectReviews\(\{ target, actorUserId: context\.userId \}\)/);
  assert.match(repository, /roomId: input\.roomId,[\s\S]*provider: input\.provider/);
  assert.match(messages, /"load": "불러오기"/);
  assert.match(messages, /"reload": "다시 불러오기"/);
  assert.match(messages, /"loadFailed": "불러오기 실패"/);
  assert.match(messages, /"noReviews": "리뷰 0개"/);
  assert.match(status, /listing\.reviewCount === 0/);
  assert.match(messages, /"collectAll": "현재 목록 리뷰 갱신"/);
});

test("미등록 플랫폼 셀은 같은 화면에서 해당 객실·플랫폼 링크만 등록하고 즉시 최초 불러오기 상태로 바뀐다", () => {
  const list = readFileSync("src/features/reviews/components/review-room-list.tsx", "utf8");
  const detail = readFileSync("src/features/reviews/components/review-room-detail.tsx", "utf8");
  const platformCell = readFileSync("src/features/reviews/components/review-platform-cell.tsx", "utf8");
  const dialog = readFileSync("src/features/reviews/components/review-listing-registration-dialog.tsx", "utf8");
  const action = readFileSync("src/features/reviews/review.actions.ts", "utf8");
  const roomRepository = readFileSync("src/features/rooms/room.repository.ts", "utf8");
  const roomSchemas = readFileSync("src/features/rooms/room.schemas.ts", "utf8");
  const messages = readFileSync("src/messages/ko.json", "utf8");

  assert.match(platformCell, /reviews\.states\.unregistered/);
  assert.match(platformCell, /ReviewListingRegistrationDialog/);
  assert.match(platformCell, /setRegisteredListing\(created\)/);
  assert.match(platformCell, /initialListing \?\? registeredListing/);
  assert.match(platformCell, /router\.refresh\(\)/);
  assert.match(dialog, /registerReviewListingAction\(\{ roomId, provider, listingUrl \}\)/);
  assert.match(dialog, /reviews\.registration\.title/);
  assert.match(dialog, /reviews\.registration\.room/);
  assert.match(dialog, /reviews\.registration\.provider/);
  assert.match(dialog, /FieldError errors=\{fieldErrors\}/);
  assert.doesNotMatch(dialog, /new URL\(|airbnb\.com\/rooms|booking\.com\/hotel/);

  assert.match(action, /roomListingRegistrationSchema\.safeParse\(input\)/);
  assert.match(action, /requireRoomAccess\(parsed\.data\.roomId, PERMISSIONS\.PROPERTY_REVIEW_SYNC\)/);
  assert.match(action, /normalizeRoomListingDrafts\(\[parsed\.data\]\)/);
  assert.match(action, /saveRoomListing\(parsed\.data\.roomId, listing\)/);
  assert.match(action, /fieldErrors: \{ listingUrl: \[error\.message\] \}/);
  assert.match(roomSchemas, /const roomListingDraftSchema/);
  assert.match(roomSchemas, /roomListingRegistrationSchema = roomListingDraftSchema\.extend/);
  assert.match(roomRepository, /function writeActiveRoomListing/);
  assert.match(roomRepository, /where: \{ roomId_provider: \{ roomId, provider: listing\.provider \} \}/);
  assert.match(roomRepository, /saveRoomListing[\s\S]*writeActiveRoomListing\(tx, roomId, listing\)/);
  assert.match(roomRepository, /input\.listingUpdates\) await writeActiveRoomListing/);

  assert.match(list, /md:hidden[\s\S]*ReviewPlatformCell/);
  assert.match(list, /hidden overflow-hidden md:block[\s\S]*ReviewPlatformCell/);
  assert.match(list, /provider=\{item\.provider\}/);
  assert.match(detail, /provider=\{provider\.provider\}/);
  assert.match(messages, /"unregistered": "미등록"/);
  assert.match(messages, /"register": "등록"/);
  assert.match(messages, /"title": "\{provider\} 숙소 링크 등록"/);
});

test("Airbnb 단건 불러오기는 Provider registry를 통해 해당 플랫폼만 수집한다", () => {
  const registry = readFileSync("src/features/reviews/providers/review-provider-registry.ts", "utf8");
  const providers = readFileSync("src/features/reviews/providers/structured-review-provider.ts", "utf8");
  const service = readFileSync("src/features/reviews/server/review-sync.service.ts", "utf8");
  assert.match(registry, /\["AIRBNB", new AirbnbReviewProvider\(\)\]/);
  assert.match(registry, /\["BOOKING", new BookingReviewProvider\(\)\]/);
  assert.match(registry, /\["AGODA", new AgodaReviewProvider\(\)\]/);
  assert.match(providers, /class AirbnbReviewProvider extends StructuredReviewProvider/);
  assert.match(service, /getReviewProvider\(target\.provider\)\.fetch/);
  assert.doesNotMatch(service, /getReviewProvider\("AIRBNB"\)/);
});
