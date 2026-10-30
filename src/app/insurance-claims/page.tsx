import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied, authorizeSidebarMenuAccess, companyScopeIds, hasPermission, PERMISSIONS } from "@/features/access-control";
import { InsuranceClaimList } from "@/features/insurance-claims/components/insurance-claim-list";
import { listInsuranceClaims } from "@/features/insurance-claims/server/insurance-claim.repository";
import { listPropertyOptions } from "@/features/properties";
import type { InsuranceClaimStatus } from "@/lib/generated/prisma/enums";

export const dynamic = "force-dynamic";
export const metadata = { title: "보험 및 보상" };

export default async function InsuranceClaimsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await authorizeSidebarMenuAccess("insurance-claims");
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const properties = await listPropertyOptions(companyScopeIds(access.context), access.context.scope);
  const propertyId = properties.some((property) => property.id === value("propertyId")) ? value("propertyId") : undefined;
  const statusValue = value("status");
  const status: InsuranceClaimStatus | undefined = statusValue === "REPORTED" || statusValue === "SUBMITTED" || statusValue === "PAID" ? statusValue : undefined;
  const requestedPage = Number(value("page"));
  const result = await listInsuranceClaims(access.context, { propertyId, status, page: Number.isSafeInteger(requestedPage) ? requestedPage : 1 });
  const paramsForPage = (page: number) => {
    const next = new URLSearchParams();
    if (propertyId) next.set("propertyId", propertyId);
    if (status) next.set("status", status);
    next.set("page", String(page));
    return `/insurance-claims?${next}`;
  };
  return <div className="space-y-5">
    <PageHeader eyebrow="INSURANCE & COMPENSATION" title="보험 및 보상" description="사고·피해의 신청 상태부터 실제 지급 완료 금액까지 관리합니다." />
    <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
      <select name="propertyId" defaultValue={propertyId ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">모든 숙소</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
      <select name="status" defaultValue={status ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">모든 상태</option><option value="REPORTED">신청 대기중</option><option value="SUBMITTED">신청 완료 · 지급 대기중</option><option value="PAID">지급 완료</option></select>
      <button className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">조회</button>
    </form>
    <InsuranceClaimList claims={result.claims} canComplete={hasPermission(access.context.role, PERMISSIONS.INSURANCE_CLAIM_COMPLETE)} canDelete={hasPermission(access.context.role, PERMISSIONS.INSURANCE_CLAIM_DELETE)} />
    {result.totalPages > 1 && <nav className="flex items-center justify-center gap-3 text-sm"><Link aria-disabled={result.page <= 1} className={result.page <= 1 ? "pointer-events-none text-muted-foreground" : "underline"} href={paramsForPage(result.page - 1)}>이전</Link><span>{result.page} / {result.totalPages} · 총 {result.total}건</span><Link aria-disabled={result.page >= result.totalPages} className={result.page >= result.totalPages ? "pointer-events-none text-muted-foreground" : "underline"} href={paramsForPage(result.page + 1)}>다음</Link></nav>}
  </div>;
}
