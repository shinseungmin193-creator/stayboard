"use client";
import { useActionState } from "react";
import { Plus, Settings2 } from "lucide-react";
import type { CompanyListItem } from "../company.types";
import { createCompanyAction, updateCompanyAction } from "../company.actions";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanyFormDialog({ company }: { company?: CompanyListItem }) {
  const [result, formAction] = useActionState(company ? updateCompanyAction : createCompanyAction, INITIAL_ACTION_RESULT);
  return <Dialog><DialogTrigger render={<Button variant={company ? "outline" : "secondary"} size={company ? "sm" : "default"} />}>{company ? <><Settings2 />수정</> : <><Plus />회사 등록</>}</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{company ? "회사 수정" : "새 회사 등록"}</DialogTitle><DialogDescription>회사명은 중복될 수 있으며, 비활성화해도 기존 숙소 데이터는 유지됩니다.</DialogDescription></DialogHeader><form action={formAction} className="space-y-4">{company && <input type="hidden" name="id" value={company.id} />}<div className="space-y-1.5"><Label htmlFor={`company-name-${company?.id ?? "new"}`}>회사명</Label><Input id={`company-name-${company?.id ?? "new"}`} name="name" defaultValue={company?.name} maxLength={100} required /><FieldError errors={!result.success ? result.fieldErrors?.name : undefined} /></div><ActionMessage result={result} /><div className="flex justify-end"><SubmitButton>{company ? "변경 저장" : "회사 등록"}</SubmitButton></div></form></DialogContent></Dialog>;
}
