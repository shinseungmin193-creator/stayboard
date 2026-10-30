import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("건물 및 객실 화면은 접근 가능한 건물을 선택한 경우에만 해당 객실을 조회한다", () => {
  const page = readFileSync("src/app/properties/page.tsx", "utf8");

  assert.match(page, /authorizeSidebarMenuAccess\("properties"\)/);
  assert.match(page, /properties\.find\(\(property\) => property\.id === requestedPropertyId\)/);
  assert.match(page, /selectedPropertyId \? await listRooms\(selectedPropertyId, companyIds\) : \[\]/);
  assert.match(page, /<PropertyList[\s\S]*selectedPropertyId=\{selectedPropertyId\}/);
  assert.match(page, /<RoomList[\s\S]*rooms=\{rooms\}/);
});

test("건물 선택 링크와 객실 등록 기본값은 선택한 건물 ID를 사용한다", () => {
  const propertyList = readFileSync("src/features/properties/components/property-list.tsx", "utf8");
  const roomDialog = readFileSync("src/features/rooms/components/room-create-dialog.tsx", "utf8");

  assert.match(propertyList, /\/properties\?propertyId=\$\{encodeURIComponent\(property\.id\)\}#rooms/);
  assert.match(roomDialog, /defaultPropertyId\?: string/);
  assert.match(roomDialog, /defaultValue=\{selectedPropertyId\}/);
});

test("기존 객실 URL은 propertyId를 보존해 통합 화면으로 이동한다", () => {
  const legacyPage = readFileSync("src/app/rooms/page.tsx", "utf8");

  assert.match(legacyPage, /redirect\(propertyId \? `\/properties\?propertyId=\$\{encodeURIComponent\(propertyId\)\}#rooms` : "\/properties"\)/);
  assert.doesNotMatch(legacyPage, /listRooms|authorizeSidebarMenuAccess\("rooms"\)/);
});
