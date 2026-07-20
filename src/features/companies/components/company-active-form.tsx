"use client";
import { useActionState } from "react";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { setCompanyActiveAction } from "../company.actions";
import { Button } from "@/components/ui/button";
export function CompanyActiveForm({ id, isActive }: { id: string; isActive: boolean }) { const [result, action, pending] = useActionState(setCompanyActiveAction, INITIAL_ACTION_RESULT); return <form action={action} className="space-y-1"><input type="hidden" name="id" value={id} /><input type="hidden" name="isActive" value={String(!isActive)} /><Button type="submit" size="sm" variant={isActive ? "outline" : "secondary"} disabled={pending}>{pending ? "변경 중" : isActive ? "비활성화" : "활성화"}</Button>{!result.success && <p className="max-w-36 text-xs text-destructive">{result.message}</p>}</form>; }
