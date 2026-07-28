import { getTranslations } from "next-intl/server";import { Building2 } from "lucide-react";
import { listCompanies, listCompanyOptions } from "@/features/companies";
import { CompanyList } from "@/features/companies/components/company-list";
import { listProperties } from "@/features/properties";
import { PropertyFormDialog } from "@/features/properties/components/property-form-dialog";
import { PropertyList } from "@/features/properties/components/property-list";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AccessDenied, authorizeAccess, companyScopeIds, hasPermission, PERMISSIONS } from "@/features/access-control";

export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("auto.m0073") }; }
export const dynamic = "force-dynamic";

export default async function PropertiesPage() {const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.PROPERTY_MANAGE);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const companyIds = companyScopeIds(access.context);
  const [companies, companyOptions, properties] = await Promise.all([listCompanies(companyIds), listCompanyOptions(companyIds), listProperties(companyIds)]);
  const hasActiveCompany = companyOptions.some((company) => company.isActive);
  const canManageCompanies = hasPermission(access.context.role, PERMISSIONS.COMPANY_MANAGE);
  return <div className="space-y-5"><PageHeader eyebrow="OPERATIONS" title={i18n("auto.m0073")} description={i18n("auto.m0074")} action={<PropertyFormDialog companies={companyOptions} />} />{canManageCompanies && <CompanyList companies={companies} />}{!hasActiveCompany && <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="flex gap-3 p-4"><Building2 className="mt-0.5 size-5 shrink-0 text-amber-600" /><div><p className="text-sm font-medium">{i18n("auto.m0075")}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{i18n("auto.m0076")}</p></div></CardContent></Card>}<PropertyList properties={properties} companies={companyOptions} /></div>;
}
