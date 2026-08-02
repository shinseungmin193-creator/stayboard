import assert from "node:assert/strict";
import test from "node:test";
import type { AccessContext } from "@/features/access-control/domain/access-control";
import { CompanySettingsAccessError, updateCompanySettingsForAccess } from "../application/update-company-settings";
import { companySettingsInputSchema, DEFAULT_COMPANY_SETTINGS, withCompanySettingsDefaults } from "../domain/company-settings";

const context = (role: AccessContext["role"], companyIds: string[] = ["company-a"]): AccessContext => role === "DEVELOPER"
  ? { userId: "test-developer", actualRole: role, previewRole: null, effectiveRole: role, isRoleSwitchActive: false, role, systemRole: "DEVELOPER", companyRole: null, allowedCompanyIds: null, allowedPropertyIds: null, developerRoleSessionId: null, scope: { mode: "all" }, source: "development-bootstrap" }
  : { userId: `test-${role.toLowerCase()}`, actualRole: role, previewRole: null, effectiveRole: role, isRoleSwitchActive: false, role, systemRole: "NONE", companyRole: role, allowedCompanyIds: companyIds, allowedPropertyIds: null, developerRoleSessionId: null, scope: { mode: "companies", companyIds }, source: "development-bootstrap" };
const input = { companyId: "company-a", ...DEFAULT_COMPANY_SETTINGS };

test("설정이 없으면 안전한 기본값을 반환한다", () => assert.deepEqual(withCompanySettingsDefaults(null), DEFAULT_COMPANY_SETTINGS));
test("timezone, HH:mm, 표시 일수 범위를 검증한다", () => {
  assert.equal(companySettingsInputSchema.safeParse({ ...input, timezone: "Invalid/Zone" }).success, false);
  assert.equal(companySettingsInputSchema.safeParse({ ...input, defaultCheckInTime: "25:00" }).success, false);
  assert.equal(companySettingsInputSchema.safeParse({ ...input, nextReservationDisplayDays: 31 }).success, false);
});
test("ADMIN은 자신의 Company 설정을 upsert한다", async () => {
  let savedCompanyId = "";
  const result = await updateCompanySettingsForAccess(context("ADMIN"), input, { companyExists: async () => true, upsert: async (companyId, settings) => { savedCompanyId = companyId; return settings; } });
  assert.equal(savedCompanyId, "company-a");
  assert.equal(result.timezone, "Asia/Tokyo");
});
test("ADMIN의 다른 Company와 STAFF 설정 변경을 거부한다", async () => {
  await assert.rejects(() => updateCompanySettingsForAccess(context("ADMIN"), { ...input, companyId: "company-b" }, { companyExists: async () => true, upsert: async () => DEFAULT_COMPANY_SETTINGS }), CompanySettingsAccessError);
  await assert.rejects(() => updateCompanySettingsForAccess(context("STAFF"), input, { companyExists: async () => true, upsert: async () => DEFAULT_COMPANY_SETTINGS }), CompanySettingsAccessError);
});
test("존재하지 않는 Company는 저장하지 않고 기존 데이터에 영향이 없다", async () => {
  let writes = 0;
  await assert.rejects(() => updateCompanySettingsForAccess(context("DEVELOPER"), input, { companyExists: async () => false, upsert: async () => { writes += 1; return DEFAULT_COMPANY_SETTINGS; } }), CompanySettingsAccessError);
  assert.equal(writes, 0);
});
