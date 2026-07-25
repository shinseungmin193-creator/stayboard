import { Building2 } from "lucide-react";
import { listCompanies, listCompanyOptions } from "@/features/companies";
import { CompanyList } from "@/features/companies/components/company-list";
import { listProperties } from "@/features/properties";
import { PropertyFormDialog } from "@/features/properties/components/property-form-dialog";
import { PropertyList } from "@/features/properties/components/property-list";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AccessDenied, authorizeAccess, companyScopeIds, hasPermission, PERMISSIONS } from "@/features/access-control";

export const metadata = { title: "숙소 관리" };
export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const access = await authorizeAccess(PERMISSIONS.PROPERTY_MANAGE);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const companyIds = companyScopeIds(access.context);
  const [companies, companyOptions, properties] = await Promise.all([listCompanies(companyIds), listCompanyOptions(companyIds), listProperties(companyIds)]);
  const hasActiveCompany = companyOptions.some((company) => company.isActive);
  const canManageCompanies = hasPermission(access.context.role, PERMISSIONS.COMPANY_MANAGE);
  return <div className="space-y-5"><PageHeader eyebrow="OPERATIONS" title="숙소 관리" description="회사별 숙소 정보와 운영 상태, 객실 현황을 관리합니다." action={<PropertyFormDialog companies={companyOptions} />} />{canManageCompanies && <CompanyList companies={companies} />}{!hasActiveCompany && <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex gap-3 p-4"><Building2 className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><p className="text-sm font-medium">활성 회사가 필요합니다</p><p className="mt-1 text-xs leading-5 text-muted-foreground">회사를 등록하거나 활성화하면 숙소를 등록할 수 있습니다.</p></div></CardContent></Card>}<PropertyList properties={properties} companies={companyOptions} /></div>;
}
