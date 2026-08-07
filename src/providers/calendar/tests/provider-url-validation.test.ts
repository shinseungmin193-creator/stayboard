import test from "node:test";
import assert from "node:assert/strict";

import { supportsProviderUrl, validateProviderUrl } from "../provider-url-policy";

test("stored Agoda export URL and observed official redirect URL are valid", () => {
  for (const value of [
    "https://ycs.agoda.com/en-us/api/ari/calendar?key=masked-fixture",
    "https://PORTAL.AGODA.COM/en-us/api/ari/calendar/?key=masked-fixture",
    "https://ycs.agoda.com/en-us/api/ari/calendar%2Dexport?key=masked-fixture",
  ]) assert.equal(validateProviderUrl("AGODA", new URL(value)).valid, true);
});

test("Agoda validation rejects other providers and unsafe or arbitrary hosts", () => {
  for (const value of [
    "https://www.airbnb.jp/calendar/ical/id.ics?t=token",
    "https://ical.booking.com/v1/export?t=token",
    "http://ycs.agoda.com/en-us/api/ari/calendar?key=token",
    "https://localhost/en-us/api/ari/calendar?key=token",
    "https://127.0.0.1/en-us/api/ari/calendar?key=token",
    "https://192.168.1.2/en-us/api/ari/calendar?key=token",
    "https://agoda.example/en-us/api/ari/calendar?key=token",
    "https://ycs.agoda.com/unrelated/calendar?key=token",
    "https://ycs.agoda.com/en-us/api/ari/calendar",
  ]) assert.equal(validateProviderUrl("AGODA", new URL(value)).valid, false, value);
});

test("Airbnb and Booking provider validation remains isolated", () => {
  assert.equal(supportsProviderUrl("AIRBNB", new URL("https://www.airbnb.jp/calendar/ical/id.ics?t=token")), true);
  assert.equal(supportsProviderUrl("BOOKING", new URL("https://ical.booking.com/v1/export?t=token")), true);
  assert.equal(supportsProviderUrl("AIRBNB", new URL("https://ycs.agoda.com/en-us/api/ari/calendar?key=token")), false);
  assert.equal(supportsProviderUrl("BOOKING", new URL("https://portal.agoda.com/en-us/api/ari/calendar?key=token")), false);
});
