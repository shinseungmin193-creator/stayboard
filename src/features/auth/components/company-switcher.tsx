"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { switchActiveCompanyAction } from "../company.actions";

export function CompanySwitcher({ companies, activeCompanyId, allowAll }: { companies: readonly { id: string; name: string }[]; activeCompanyId?: string | null; allowAll: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  if (companies.length < 2 && !allowAll) return null;
  return <select aria-label="현재 회사" value={activeCompanyId ?? ""} disabled={pending} onChange={(event) => { const companyId = event.target.value; startTransition(async () => { const result = await switchActiveCompanyAction({ companyId }); if (result.success) router.refresh(); }); }} className="h-8 max-w-48 rounded-md border border-input bg-background px-2 text-xs"><option value="" disabled={!allowAll}>전체 회사</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>;
}
