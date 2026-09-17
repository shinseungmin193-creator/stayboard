import assert from "node:assert/strict";
import test from "node:test";
import { ListingUrlError, validateListingUrl } from "../../reviews/domain/listing-provider";
import { normalizeRoomListingDrafts, planRoomListingWrites } from "../room-listing";

const complete = (airbnb = "", booking = "", agoda = "") => [
  { provider: "AIRBNB" as const, listingUrl: airbnb },
  { provider: "BOOKING" as const, listingUrl: booking },
  { provider: "AGODA" as const, listingUrl: agoda },
];

test("Airbnb, Booking.com, Agoda 숙소 링크를 정규화해 저장 대상으로 만든다", () => {
  const listings = normalizeRoomListingDrafts(complete(
    "https://www.airbnb.com/rooms/123456?utm_source=test#reviews",
    "https://www.booking.com/hotel/jp/example.html?aid=1",
    "https://www.agoda.com/example/hotel/example.html",
  ));
  assert.deepEqual(listings.map((listing) => listing.provider), ["AIRBNB", "BOOKING", "AGODA"]);
  assert.equal(listings[0]?.listingUrl, "https://www.airbnb.com/rooms/123456");
  assert.equal(listings[0]?.externalListingId, "123456");
  assert.equal(listings[1]?.listingUrl.includes("aid="), false);
});

test("빈 숙소 링크는 허용하고 생성하지 않는다", () => {
  assert.deepEqual(normalizeRoomListingDrafts(complete()), []);
});

test("빠른 등록은 전달한 한 플랫폼만 정규화해 다른 플랫폼 입력을 만들지 않는다", () => {
  const listings = normalizeRoomListingDrafts([{
    provider: "BOOKING",
    listingUrl: "https://www.booking.com/hotel/jp/example.html?aid=1",
  }]);
  assert.equal(listings.length, 1);
  assert.equal(listings[0]?.provider, "BOOKING");
  assert.equal(listings[0]?.listingUrl, "https://www.booking.com/hotel/jp/example.html");
});

test("Airbnb 공식 국가 도메인과 공유 쿼리 URL을 허용한다", () => {
  for (const url of [
    "https://www.airbnb.com/rooms/123456789",
    "https://airbnb.com/rooms/123456789",
    "https://www.airbnb.co.kr/rooms/123456789",
    "https://www.airbnb.co.jp/rooms/123456789",
    "https://www.airbnb.co.uk/rooms/123456789",
    "https://www.airbnb.fr/rooms/123456789/",
    "https://www.airbnb.de/rooms/123456789",
    "https://www.airbnb.co.kr/rooms/1717217172042862004?guests=1&adults=1&s=67&unique_share_id=fd448a18-1f13-4aa4-b015-475023dd71e1",
  ]) {
    assert.doesNotThrow(() => validateListingUrl("AIRBNB", url), url);
  }

  const normalized = normalizeRoomListingDrafts(complete(
    "https://www.airbnb.co.kr/rooms/1717217172042862004?guests=1&adults=1&s=67&unique_share_id=fd448a18-1f13-4aa4-b015-475023dd71e1",
  ))[0];
  assert.equal(normalized?.externalListingId, "1717217172042862004");
  assert.equal(normalized?.listingUrl, "https://www.airbnb.co.kr/rooms/1717217172042862004?guests=1&adults=1&s=67&unique_share_id=fd448a18-1f13-4aa4-b015-475023dd71e1");
});

test("Airbnb 유사 도메인과 숙소 상세가 아닌 경로를 차단한다", () => {
  for (const url of [
    "https://google.com/rooms/123",
    "https://airbnb.fake-domain.com/rooms/123",
    "https://www.airbnb.co.kr/",
    "https://www.airbnb.co.kr/help",
    "https://www.airbnb.co.kr/rooms/not-a-number",
    "http://www.airbnb.co.kr/rooms/123",
  ]) {
    assert.throws(() => validateListingUrl("AIRBNB", url), ListingUrlError, url);
  }
});

test("Booking과 Agoda는 언어 경로를 허용하고 상세 페이지가 아닌 URL을 차단한다", () => {
  for (const [provider, url] of [
    ["BOOKING", "https://www.booking.com/hotel/jp/example.html?aid=1&lang=ko"],
    ["AGODA", "https://www.agoda.com/ko-kr/example/hotel/seoul-kr.html?cid=1"],
  ] as const) {
    assert.doesNotThrow(() => validateListingUrl(provider, url), url);
  }
  for (const [provider, url] of [
    ["BOOKING", "https://www.booking.com/"],
    ["BOOKING", "https://www.booking.com/help"],
    ["AGODA", "https://www.agoda.com/"],
    ["AGODA", "https://www.agoda.com/en-us/index.html"],
  ] as const) {
    assert.throws(() => validateListingUrl(provider, url), ListingUrlError, url);
  }
});

test("플랫폼과 다른 도메인은 명확한 Provider 오류로 차단한다", () => {
  for (const [provider, url] of [
    ["AIRBNB", "https://booking.com/hotel/jp/a.html"],
    ["BOOKING", "https://agoda.com/a"],
    ["AGODA", "https://example.com/a"],
  ] as const) {
    assert.throws(() => normalizeRoomListingDrafts([{ provider, listingUrl: url }]), (error: unknown) => error instanceof ListingUrlError && error.provider === provider);
  }
});

test("링크 추가, 수정, 제거를 하나의 write plan으로 만든다", () => {
  const current = [
    { id: "airbnb", provider: "AIRBNB" as const, listingUrl: "https://www.airbnb.com/rooms/1", isActive: true },
    { id: "booking", provider: "BOOKING" as const, listingUrl: "https://www.booking.com/hotel/jp/old.html", isActive: true },
  ];
  const plan = planRoomListingWrites(complete(
    "",
    "https://www.booking.com/hotel/jp/new.html",
    "https://www.agoda.com/new/hotel/new.html",
  ), current);
  assert.deepEqual(plan.listingDeactivations, [{ id: "airbnb" }]);
  assert.equal(plan.listingUpdates[0]?.id, "booking");
  assert.equal(plan.listingUpdates[0]?.listingUrl, "https://www.booking.com/hotel/jp/new.html");
  assert.equal(plan.listingCreates[0]?.provider, "AGODA");
});

test("비활성 링크를 다시 입력하면 새 행 대신 기존 행을 활성화한다", () => {
  const plan = planRoomListingWrites(complete("https://www.airbnb.com/rooms/9"), [
    { id: "airbnb", provider: "AIRBNB", listingUrl: "https://www.airbnb.com/rooms/8", isActive: false },
  ]);
  assert.equal(plan.listingCreates.length, 0);
  assert.deepEqual(plan.listingUpdates.map(({ id, isActive }) => ({ id, isActive })), [{ id: "airbnb", isActive: true }]);
});
