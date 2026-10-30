"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { CheckCircle2, Images, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import type { InsuranceClaimStatus, InsuranceClaimType } from "@/lib/generated/prisma/enums";
import { INSURANCE_CLAIM_TYPES, INSURANCE_CLAIM_TYPE_LABELS } from "../domain/insurance-claim";
import { submitInsuranceClaimAction } from "../insurance-claim.actions";

interface ClaimItem {
  id: string;
  content: string;
  types: InsuranceClaimType[];
  status: InsuranceClaimStatus;
  reporterName: string;
  createdAt: Date;
  submittedAt: Date | null;
  submittedByName: string | null;
  property: { name: string };
  room: { name: string; code: string };
  photos: Array<{ id: string; originalName: string }>;
}

function ClaimCard({ initialClaim, canComplete }: { initialClaim: ClaimItem; canComplete: boolean }) {
  const [claim, setClaim] = useState(initialClaim);
  const [types, setTypes] = useState<InsuranceClaimType[]>(initialClaim.types);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const completed = claim.status === "SUBMITTED";
  const submit = () => startTransition(async () => {
    setError(null);
    const result = await submitInsuranceClaimAction({ id: claim.id, types });
    if (!result.success || !result.data) { setError(result.message || "신청 완료하지 못했습니다."); return; }
    setClaim((current) => ({ ...current, status: "SUBMITTED", types: result.data!.types, submittedAt: new Date(result.data!.submittedAt), submittedByName: result.data!.submittedByName }));
  });

  return <article className="space-y-4 rounded-xl border bg-card p-4 shadow-sm" data-insurance-claim-id={claim.id}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">{claim.property.name} · {claim.room.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">보고 {new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(claim.createdAt)} / {claim.reporterName}</p>
      </div>
      <Badge variant="outline" className={completed ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"}>{completed ? "신청 완료" : "접수"}</Badge>
    </div>
    <p className="whitespace-pre-wrap text-sm leading-6">{claim.content}</p>
    <fieldset disabled={completed || pending || !canComplete} className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">신청 종류</legend>
      <div className="flex flex-wrap gap-2">
        {INSURANCE_CLAIM_TYPES.map((type) => <label key={type} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"><input type="checkbox" checked={types.includes(type)} onChange={() => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])} />{INSURANCE_CLAIM_TYPE_LABELS[type]}</label>)}
      </div>
    </fieldset>
    {claim.photos.length > 0 ? <div className="flex gap-2 overflow-x-auto">{claim.photos.map((photo) => <a key={photo.id} href={withBasePath(`/api/insurance-claims/photos/${encodeURIComponent(photo.id)}`)} target="_blank" rel="noreferrer" className="block shrink-0"><Image unoptimized width={80} height={80} src={withBasePath(`/api/insurance-claims/photos/${encodeURIComponent(photo.id)}`)} alt={photo.originalName} className="size-20 rounded-lg border object-cover" /></a>)}</div> : <p className="flex items-center gap-1 text-xs text-muted-foreground"><Images className="size-4" />사진 없음</p>}
    {completed ? <p className="text-xs text-muted-foreground">신청 완료 {claim.submittedAt ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(claim.submittedAt) : ""} / {claim.submittedByName ?? "-"}</p> : canComplete && <div className="flex justify-end"><Button type="button" disabled={pending || types.length === 0} onClick={submit}>{pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}선택 종류 신청 완료</Button></div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </article>;
}

export function InsuranceClaimList({ claims, canComplete }: { claims: ClaimItem[]; canComplete: boolean }) {
  if (!claims.length) return <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">등록된 보험/보상 보고가 없습니다.</div>;
  return <div className="grid gap-3 lg:grid-cols-2">{claims.map((claim) => <ClaimCard key={claim.id} initialClaim={claim} canComplete={canComplete} />)}</div>;
}

