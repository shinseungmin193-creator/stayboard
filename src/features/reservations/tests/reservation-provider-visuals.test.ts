import test from "node:test";
import assert from "node:assert/strict";
import { getProviderVisual, getReservationBarLabel, PROVIDER_VISUALS, RESERVATION_CONFLICT_VISUAL } from "../provider-visuals";

test("Airbnb, Booking.com, Agoda 예약 막대 이름을 표시한다", () => {
  assert.equal(getReservationBarLabel("AIRBNB", 120), "Airbnb 예약");
  assert.equal(getReservationBarLabel("BOOKING", 120), "Booking.com 예약");
  assert.equal(getReservationBarLabel("AGODA", 120), "Agoda 예약");
});

test("좁은 막대는 Provider 이름을 축약 표시한다", () => {
  assert.equal(getReservationBarLabel("BOOKING", 64), "Booking");
  assert.equal(getReservationBarLabel("AIRBNB", 24), "Airbnb");
});

test("알 수 없는 Provider는 기타 회색 스타일을 사용한다", () => {
  assert.equal(getReservationBarLabel("UNKNOWN", 120), "기타 예약");
  assert.equal(getProviderVisual(undefined), PROVIDER_VISUALS.OTHER);
  assert.match(PROVIDER_VISUALS.OTHER.className, /slate/);
});

test("모든 Provider 색상은 Light와 Dark 글자 대비 클래스를 갖는다", () => {
  for (const visual of Object.values(PROVIDER_VISUALS)) {
    assert.match(visual.className, /text-/);
    assert.match(visual.className, /dark:bg-/);
    assert.match(visual.className, /dark:text-/);
  }
});

test("오버부킹은 Provider 색상과 별도의 경고 테두리를 사용한다", () => {
  assert.match(RESERVATION_CONFLICT_VISUAL, /ring-destructive/);
  assert.match(RESERVATION_CONFLICT_VISUAL, /border-destructive/);
});
