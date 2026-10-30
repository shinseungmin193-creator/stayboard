import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { hasPermission, PERMISSIONS } from "../../access-control/domain/access-control";
import { INSURANCE_CLAIM_TYPE_LABELS } from "../domain/insurance-claim";
import { createInsuranceClaimSchema, submitInsuranceClaimSchema } from "../insurance-claim.schemas";

test("개발자·관리자·직원 모두 객실에서 보험/보상 보고를 등록할 수 있다", () => {
  for (const role of ["DEVELOPER", "ADMIN", "STAFF"] as const) assert.equal(hasPermission(role, PERMISSIONS.INSURANCE_CLAIM_CREATE), true);
});

test("보험 및 보상 관리 목록과 신청 완료는 개발자·관리자에게만 허용한다", () => {
  for (const role of ["DEVELOPER", "ADMIN"] as const) {
    assert.equal(hasPermission(role, PERMISSIONS.INSURANCE_CLAIM_READ), true);
    assert.equal(hasPermission(role, PERMISSIONS.INSURANCE_CLAIM_COMPLETE), true);
  }
  assert.equal(hasPermission("STAFF", PERMISSIONS.INSURANCE_CLAIM_READ), false);
  assert.equal(hasPermission("STAFF", PERMISSIONS.INSURANCE_CLAIM_COMPLETE), false);
});

test("화재보험과 OTA 종류를 중복 선택하고 중복 값은 정규화한다", () => {
  assert.deepEqual(INSURANCE_CLAIM_TYPE_LABELS, { FIRE_INSURANCE: "화재보험", AIRBNB: "에어비앤비", BOOKING: "부킹", AGODA: "아고다", EXPEDIA: "익스피디아" });
  const parsed = submitInsuranceClaimSchema.parse({ id: "claim", types: ["FIRE_INSURANCE", "AIRBNB", "AIRBNB"] });
  assert.deepEqual(parsed.types, ["FIRE_INSURANCE", "AIRBNB"]);
});

test("보고 등록은 내용만 필수이고 신청 완료 단계에서 종류를 요구한다", () => {
  assert.equal(createInsuranceClaimSchema.safeParse({ propertyId: "p", roomId: "r", content: "", types: ["AIRBNB"] }).success, false);
  const reported = createInsuranceClaimSchema.parse({ propertyId: "p", roomId: "r", content: "보고" });
  assert.deepEqual(reported.types, []);
  assert.equal(submitInsuranceClaimSchema.safeParse({ id: "claim", types: [] }).success, false);
});

test("사진이 없어도 보고 등록 payload는 정상이며 UI가 선택 사항임을 안내한다", () => {
  const parsed = createInsuranceClaimSchema.safeParse({ propertyId: "p", roomId: "r", content: "사진 없는 피해 보고" });
  assert.equal(parsed.success, true);
  const dialog = readFileSync("src/features/insurance-claims/components/insurance-claim-composer-dialog.tsx", "utf8");
  assert.match(dialog, /사진 \(선택 · 없어도 등록 가능, 최대 12장\)/);
  assert.doesNotMatch(dialog, /신청 종류 \(중복 선택 가능\)/);
  assert.match(dialog, /disabled=\{pending \|\| !content\.trim\(\)\}/);
});

test("sidebar·페이지·서버 action이 같은 보험/보상 권한을 사용한다", () => {
  const sidebar = readFileSync("src/features/sidebar-preferences/domain/sidebar-menu.ts", "utf8");
  const page = readFileSync("src/app/insurance-claims/page.tsx", "utf8");
  const actions = readFileSync("src/features/insurance-claims/insurance-claim.actions.ts", "utf8");
  assert.match(sidebar, /id: "insurance-claims"[\s\S]*INSURANCE_CLAIM_READ/);
  assert.match(page, /authorizeSidebarMenuAccess\("insurance-claims"\)/);
  assert.match(actions, /INSURANCE_CLAIM_CREATE/);
  assert.match(actions, /INSURANCE_CLAIM_COMPLETE/);
});

test("신청 완료는 REPORTED 상태에서만 원자적으로 변경하고 감사 로그를 남긴다", () => {
  const service = readFileSync("src/features/insurance-claims/server/insurance-claim.service.ts", "utf8");
  assert.match(service, /updateMany\([\s\S]*status: "REPORTED"/);
  assert.match(service, /INSURANCE_CLAIM_SUBMITTED/);
  assert.match(service, /pg_advisory_xact_lock/);
});

test("객실 현황은 보험 건수를 bulk count로 가져오고 상태와 동기화 사이에 표시한다", () => {
  const repository = readFileSync("src/features/room-overview/infrastructure/room-overview.repository.ts", "utf8");
  const list = readFileSync("src/features/room-overview/components/room-overview-list-view.tsx", "utf8");
  assert.match(repository, /_count: \{ select: \{ roomNotes: true, insuranceClaims: true \} \}/);
  const statusColumn = list.indexOf("inspectionStatus");
  const insuranceColumn = list.indexOf("보험/보상", statusColumn);
  const syncColumn = list.indexOf("lastSync", insuranceColumn);
  assert.ok(statusColumn >= 0 && insuranceColumn > statusColumn && syncColumn > insuranceColumn);
});

