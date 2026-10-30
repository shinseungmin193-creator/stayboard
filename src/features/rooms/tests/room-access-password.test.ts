import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { roomAccessPasswordUpdateSchema } from "../room.schemas";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync("prisma/migrations/20261030200000_add_room_access_password/migration.sql", "utf8");
const actions = readFileSync("src/features/rooms/room-access-password.actions.ts", "utf8");
const crypto = readFileSync("src/features/rooms/server/room-access-password-crypto.ts", "utf8");
const service = readFileSync("src/features/rooms/server/room-access-password.service.ts", "utf8");
const dialog = readFileSync("src/features/rooms/components/room-access-password-dialog.tsx", "utf8");
const page = readFileSync("src/app/room-overview/page.tsx", "utf8");
const desktopList = readFileSync("src/features/room-overview/components/room-overview-list-view.tsx", "utf8");
const mobileList = readFileSync("src/features/room-overview/components/room-status-list.tsx", "utf8");

test("객실 비밀번호 입력은 공백을 정리하고 빈 값 삭제를 허용하되 줄바꿈과 장문을 거부한다", () => {
  assert.deepEqual(roomAccessPasswordUpdateSchema.parse({ roomId: "room-1", password: "  1234#  " }), { roomId: "room-1", password: "1234#" });
  assert.equal(roomAccessPasswordUpdateSchema.safeParse({ roomId: "room-1", password: "   " }).success, true);
  assert.equal(roomAccessPasswordUpdateSchema.safeParse({ roomId: "room-1", password: "12\n34" }).success, false);
  assert.equal(roomAccessPasswordUpdateSchema.safeParse({ roomId: "room-1", password: "a".repeat(101) }).success, false);
});

test("비밀번호는 Room의 암호문 전용 필드에 저장하고 평문 필드를 만들지 않는다", () => {
  assert.match(schema, /accessPasswordEncrypted\s+String\?\s+@db\.Text/);
  assert.doesNotMatch(schema, /^\s+accessPassword\s+/m);
  assert.match(migration, /ADD COLUMN "accessPasswordEncrypted" TEXT/);
  assert.match(crypto, /aes-256-gcm/);
  assert.match(crypto, /randomBytes\(IV_LENGTH\)/);
  assert.match(crypto, /getAuthTag\(\)/);
  assert.match(crypto, /ROOM_ACCESS_PASSWORD_ENCRYPTION_KEY/);
});

test("조회와 변경 Server Action은 각각 중앙 권한과 객실 범위를 다시 검증한다", () => {
  assert.match(actions, /requireRoomAccess\(parsed\.data\.roomId, PERMISSIONS\.ROOM_ACCESS_PASSWORD_READ\)/);
  assert.match(actions, /requireRoomAccess\(parsed\.data\.roomId, PERMISSIONS\.ROOM_ACCESS_PASSWORD_MANAGE\)/);
  assert.match(service, /canAccessCompany\(context, room\.property\.companyId\)/);
  assert.match(service, /canAccessRoom\(context, room\)/);
  assert.match(service, /pg_advisory_xact_lock/);
});

test("조회·변경 이력에는 비밀번호 원문 없이 설정 여부만 기록한다", () => {
  assert.match(service, /action: "ROOM_ACCESS_PASSWORD_VIEWED"/);
  assert.match(service, /action: "ROOM_ACCESS_PASSWORD_UPDATED"/);
  assert.match(service, /previousConfigured: Boolean\(room\.accessPasswordEncrypted\)/);
  assert.match(service, /configured: Boolean\(encrypted\)/);
  const auditDetails = [...service.matchAll(/details:\s*withAccessAuditMetadata\(context, \{([\s\S]*?)\}\),/g)].map((match) => match[1]);
  assert.equal(auditDetails.length, 2);
  for (const details of auditDetails) assert.doesNotMatch(details, /\bpassword\s*:/i);
});

test("객실 현황은 비밀번호를 초기 payload에 포함하지 않고 클릭할 때만 조회한다", () => {
  assert.match(dialog, /getRoomAccessPasswordAction\(\{ roomId \}\)/);
  assert.match(dialog, /if \(next\) void load\(\)/);
  assert.match(dialog, /setPassword\(""\)/);
  assert.match(page, /PERMISSIONS\.ROOM_ACCESS_PASSWORD_READ/);
  assert.match(page, /PERMISSIONS\.ROOM_ACCESS_PASSWORD_MANAGE/);
  assert.match(desktopList, /RoomAccessPasswordDialog/);
  assert.match(mobileList, /RoomAccessPasswordDialog/);
  assert.doesNotMatch(readFileSync("src/features/room-overview/infrastructure/room-overview.repository.ts", "utf8"), /accessPasswordEncrypted/);
});

test("직원 UI는 조회만 하고 관리자 UI에서만 입력과 저장을 렌더링한다", () => {
  assert.match(dialog, /loaded && !canManage/);
  assert.match(dialog, /loaded && canManage/);
  assert.match(dialog, /canManage && loaded && <Button/);
  assert.match(dialog, /직원 계정은 조회만 가능합니다|roomAccessPassword/);
});
