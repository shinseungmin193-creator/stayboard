"use client";import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import type { CompanyOption } from "@/features/companies";
import type { PropertyListItem } from "../property.types";
import { createPropertyAction, updatePropertyAction } from "../property.actions";
import type { ActionResult } from "@/lib/action-result";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PropertyFormDialog({ companies, property }: {companies: CompanyOption[];property?: PropertyListItem;}) {const i18n = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult>(INITIAL_ACTION_RESULT);
  const activeCompanies = companies.filter((company) => company.isActive);
  const selectableCompanies = property ? companies : activeCompanies;
  const disabled = !property && activeCompanies.length === 0;
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setResult(INITIAL_ACTION_RESULT);
    setOpen(nextOpen);
  };
  const submit = async (formData: FormData) => {
    const action = property ? updatePropertyAction : createPropertyAction;
    const actionResult = await action(INITIAL_ACTION_RESULT, formData);
    setResult(actionResult);
    if (actionResult.success) {
      setOpen(false);
      router.refresh();
    }
  };
  return <Dialog open={open} onOpenChange={handleOpenChange}><DialogTrigger render={<Button variant={property ? "outline" : "default"} size={property ? "sm" : "default"} disabled={disabled} />}>{property ? <><Settings2 />{i18n("common.edit")}</> : <><Plus />{i18n("auto.m0363")}</>}</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{property ? i18n("auto.m0364") : i18n("auto.m0365")}</DialogTitle><DialogDescription>{i18n("auto.m0366")}</DialogDescription></DialogHeader><form action={submit} className="space-y-4">{property && <input type="hidden" name="id" value={property.id} />}<div className="space-y-1.5"><Label htmlFor={`company-${property?.id ?? "new"}`}>{i18n("auto.m0107")}</Label><select id={`company-${property?.id ?? "new"}`} name="companyId" defaultValue={property?.companyId ?? (activeCompanies.length === 1 ? activeCompanies[0].id : "")} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>{i18n("auto.m0367")}</option>{selectableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.isActive ? "" : i18n("auto.m0287")}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.companyId : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`property-name-${property?.id ?? "new"}`}>{i18n("auto.m0326")}</Label><Input id={`property-name-${property?.id ?? "new"}`} name="name" defaultValue={property?.name} maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`address-${property?.id ?? "new"}`}>{i18n("auto.m0368")}</Label><Input id={`address-${property?.id ?? "new"}`} name="address" defaultValue={property?.address} maxLength={300} required /><FieldError errors={!result.success ? result.fieldErrors?.address : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`timezone-${property?.id ?? "new"}`}>{i18n("auto.m0369")}</Label><Input id={`timezone-${property?.id ?? "new"}`} name="timezone" defaultValue={property?.timezone ?? "Asia/Tokyo"} required /><FieldError errors={!result.success ? result.fieldErrors?.timezone : undefined} /></div><ActionMessage result={result} /><div className="flex justify-end"><SubmitButton>{property ? i18n("auto.m0184") : i18n("auto.m0363")}</SubmitButton></div></form></DialogContent></Dialog>;
}
