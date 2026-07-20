"use client";
import { useActionState } from "react";
import { Plus, Settings2 } from "lucide-react";
import type { CompanyOption } from "@/features/companies";
import type { PropertyListItem } from "../property.types";
import { createPropertyAction, updatePropertyAction } from "../property.actions";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PropertyFormDialog({ companies, property }: { companies: CompanyOption[]; property?: PropertyListItem }) {
  const [result, formAction] = useActionState(property ? updatePropertyAction : createPropertyAction, INITIAL_ACTION_RESULT);
  const activeCompanies = companies.filter((company) => company.isActive);
  const selectableCompanies = property ? companies : activeCompanies;
  const disabled = !property && activeCompanies.length === 0;
  return <Dialog><DialogTrigger render={<Button variant={property ? "outline" : "default"} size={property ? "sm" : "default"} disabled={disabled} />}>{property ? <><Settings2 />수정</> : <><Plus />숙소 등록</>}</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{property ? "숙소 수정" : "새 숙소 등록"}</DialogTitle><DialogDescription>비활성 회사에는 새 숙소를 등록할 수 없습니다.</DialogDescription></DialogHeader><form action={formAction} className="space-y-4">{property && <input type="hidden" name="id" value={property.id} />}<div className="space-y-1.5"><Label htmlFor={`company-${property?.id ?? "new"}`}>회사</Label><select id={`company-${property?.id ?? "new"}`} name="companyId" defaultValue={property?.companyId ?? (activeCompanies.length === 1 ? activeCompanies[0].id : "")} className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" required><option value="" disabled>회사를 선택하세요</option>{selectableCompanies.map((company) => <option key={company.id} value={company.id}>{company.name}{company.isActive ? "" : " (비활성)"}</option>)}</select><FieldError errors={!result.success ? result.fieldErrors?.companyId : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`property-name-${property?.id ?? "new"}`}>숙소명</Label><Input id={`property-name-${property?.id ?? "new"}`} name="name" defaultValue={property?.name} maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`address-${property?.id ?? "new"}`}>주소</Label><Input id={`address-${property?.id ?? "new"}`} name="address" defaultValue={property?.address} maxLength={300} required /><FieldError errors={!result.success ? result.fieldErrors?.address : undefined} /></div><div className="space-y-1.5"><Label htmlFor={`timezone-${property?.id ?? "new"}`}>타임존</Label><Input id={`timezone-${property?.id ?? "new"}`} name="timezone" defaultValue={property?.timezone ?? "Asia/Tokyo"} required /><FieldError errors={!result.success ? result.fieldErrors?.timezone : undefined} /></div><ActionMessage result={result} /><div className="flex justify-end"><SubmitButton>{property ? "변경 저장" : "숙소 등록"}</SubmitButton></div></form></DialogContent></Dialog>;
}
