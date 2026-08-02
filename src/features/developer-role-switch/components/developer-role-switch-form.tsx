"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Search, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startDeveloperRoleSessionAction, updateDeveloperRoleSessionAction } from "../developer-role-switch.actions";
import type { ActiveDeveloperRoleSwitch, DeveloperRolePropertyScopeMode, DeveloperRoleSwitchOptions, DeveloperRoleSwitchRole } from "../domain/developer-role-switch.types";

export function DeveloperRoleSwitchForm({
  options,
  active,
  onSuccess,
}: {
  options: DeveloperRoleSwitchOptions;
  active: ActiveDeveloperRoleSwitch | null;
  onSuccess(path: string): void;
}) {
  const t = useTranslations("developerRoleSwitch");
  const [companySearch, setCompanySearch] = useState("");
  const [companyId, setCompanyId] = useState(active?.companyId ?? options.companies[0]?.id ?? "");
  const [previewRole, setPreviewRole] = useState<DeveloperRoleSwitchRole>(active?.previewRole ?? "ADMIN");
  const [scopeMode, setScopeMode] = useState<DeveloperRolePropertyScopeMode>(active?.propertyScope.mode ?? "ALL");
  const [propertyIds, setPropertyIds] = useState<string[]>(active?.propertyScope.propertyIds ?? []);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const selectedCompany = options.companies.find((company) => company.id === companyId) ?? null;
  const visibleCompanies = useMemo(() => {
    const query = companySearch.trim().toLocaleLowerCase();
    return query ? options.companies.filter((company) => company.name.toLocaleLowerCase().includes(query)) : options.companies;
  }, [companySearch, options.companies]);

  const selectCompany = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    setPropertyIds([]);
  };
  const toggleProperty = (propertyId: string) => {
    setPropertyIds((current) => current.includes(propertyId) ? current.filter((id) => id !== propertyId) : [...current, propertyId]);
  };
  const submit = () => startTransition(async () => {
    setMessage(undefined);
    const action = active ? updateDeveloperRoleSessionAction : startDeveloperRoleSessionAction;
    const result = await action({
      previewRole,
      companyId,
      propertyScopeMode: previewRole === "ADMIN" ? "ALL" : scopeMode,
      propertyIds: previewRole === "STAFF" && scopeMode === "SELECTED" ? propertyIds : [],
    });
    if (!result.success || !result.data) {
      setMessage(result.message);
      return;
    }
    onSuccess(result.data.redirectPath);
  });

  return <div className="space-y-5">
    <section className="space-y-2" aria-labelledby="role-switch-company-label">
      <div className="flex items-center justify-between gap-2">
        <h3 id="role-switch-company-label" className="text-sm font-semibold">{t("fields.company")}</h3>
        <span className="text-xs text-muted-foreground">{t("fields.singleCompany")}</span>
      </div>
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder={t("fields.searchCompany")} className="pl-9" />
      </label>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border p-1" role="listbox" aria-label={t("fields.company")}>
        {visibleCompanies.map((company) => <button key={company.id} type="button" role="option" aria-selected={company.id === companyId} onClick={() => selectCompany(company.id)} className={cn("flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm", company.id === companyId ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          <Building2 className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{company.name}</span><span className="text-xs opacity-75">{t("propertyCount", { count: company.properties.length })}</span>
        </button>)}
        {!visibleCompanies.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("fields.noCompany")}</p>}
      </div>
    </section>

    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{t("fields.role")}</legend>
      <div className="grid grid-cols-2 gap-2">
        {(["ADMIN", "STAFF"] as const).map((role) => <label key={role} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border p-3", previewRole === role && "border-primary bg-primary/5 ring-1 ring-primary/20")}>
          <input type="radio" name="developer-role-switch-role" value={role} checked={previewRole === role} onChange={() => setPreviewRole(role)} className="sr-only" />
          {role === "ADMIN" ? <ShieldCheck className="size-5 text-primary" /> : <UserRound className="size-5 text-primary" />}
          <span><strong className="block text-sm">{t(`roles.${role}.title`)}</strong><span className="text-xs text-muted-foreground">{t(`roles.${role}.description`)}</span></span>
        </label>)}
      </div>
    </fieldset>

    {previewRole === "STAFF" && <fieldset className="space-y-3">
      <legend className="text-sm font-semibold">{t("fields.propertyScope")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["ALL", "SELECTED"] as const).map((mode) => <label key={mode} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm", scopeMode === mode && "border-primary bg-primary/5")}>
          <input type="radio" name="developer-role-switch-scope" value={mode} checked={scopeMode === mode} onChange={() => setScopeMode(mode)} />
          {t(`scope.${mode}`)}
        </label>)}
      </div>
      {scopeMode === "SELECTED" && <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
        {selectedCompany?.properties.map((property) => <label key={property.id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted">
          <input type="checkbox" checked={propertyIds.includes(property.id)} onChange={() => toggleProperty(property.id)} className="size-4 accent-primary" />
          <span className="min-w-0 flex-1 truncate">{property.name}</span>
        </label>)}
        {!selectedCompany?.properties.length && <p className="px-2 py-5 text-center text-sm text-muted-foreground">{t("fields.noProperty")}</p>}
      </div>}
    </fieldset>}

    {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    <Button type="button" className="w-full" disabled={pending || !companyId || (previewRole === "STAFF" && scopeMode === "SELECTED" && !propertyIds.length)} onClick={submit}>
      <ShieldCheck />{pending ? t("actions.processing") : active ? t("actions.update") : t("actions.start")}
    </Button>
  </div>;
}
