import type { AccessContext } from "@/features/access-control/domain/access-control";
import { canAccessCompany, hasPermission, PERMISSIONS } from "@/features/access-control/domain/access-control";
import type { CompanySettingsInput, CompanySettingsValues } from "../domain/company-settings";

export class CompanySettingsAccessError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "COMPANY_NOT_FOUND") {
    super(code === "FORBIDDEN" ? "이 회사의 관리자 설정을 변경할 권한이 없습니다." : "회사를 찾을 수 없습니다.");
    this.name = "CompanySettingsAccessError";
  }
}

export interface UpdateCompanySettingsDependencies {
  companyExists(companyId: string): Promise<boolean>;
  upsert(companyId: string, settings: CompanySettingsValues): Promise<CompanySettingsValues>;
}

export async function updateCompanySettingsForAccess(
  context: AccessContext,
  input: CompanySettingsInput,
  dependencies: UpdateCompanySettingsDependencies,
) {
  if (!hasPermission(context.role, PERMISSIONS.ADMIN_SETTINGS_MANAGE) || !canAccessCompany(context, input.companyId)) {
    throw new CompanySettingsAccessError("FORBIDDEN");
  }
  if (!await dependencies.companyExists(input.companyId)) throw new CompanySettingsAccessError("COMPANY_NOT_FOUND");
  const { companyId, ...settings } = input;
  return dependencies.upsert(companyId, settings);
}
