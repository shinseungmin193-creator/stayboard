"use client";import { useTranslations } from "next-intl";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveCompanyAction } from "../company.actions";

export function CompanySwitcher({ companies, activeCompanyId, allowAll }: {companies: readonly {id: string;name: string;}[];activeCompanyId?: string | null;allowAll: boolean;}) {const i18n = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (companies.length < 2 && !allowAll) return null;
  return <select aria-label={i18n("auto.m0189")} value={activeCompanyId ?? ""} disabled={pending} onChange={(event) => {const companyId = event.target.value;startTransition(async () => {const result = await switchActiveCompanyAction({ companyId });if (result.success) router.refresh();});}} className="h-8 max-w-48 rounded-md border border-input bg-background px-2 text-xs"><option value="" disabled={!allowAll}>{i18n("auto.m0190")}</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>;
}
