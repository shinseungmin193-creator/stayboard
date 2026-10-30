"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleDollarSign, Images, LoaderCircle, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import type { InsuranceClaimStatus, InsuranceClaimType } from "@/lib/generated/prisma/enums";
import { INSURANCE_CLAIM_TYPES, INSURANCE_CLAIM_TYPE_LABELS } from "../domain/insurance-claim";
import { completeInsurancePayoutAction, deleteInsuranceClaimAction, submitInsuranceClaimAction } from "../insurance-claim.actions";

interface ClaimItem {
  id: string;
  content: string;
  types: InsuranceClaimType[];
  status: InsuranceClaimStatus;
  reporterName: string;
  createdAt: Date;
  submittedAt: Date | null;
  submittedByName: string | null;
  paidAmount: number | null;
  paidAt: Date | null;
  paidByName: string | null;
  property: { name: string };
  room: { name: string; code: string };
  photos: Array<{ id: string; originalName: string }>;
}

const formatDateTime = (value: Date) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Tokyo",
  dateStyle: "medium",
  timeStyle: "short",
}).format(value);

const formatPaidAmount = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}엔`;

function ClaimStatusBadge({ status }: { status: InsuranceClaimStatus }) {
  if (status === "PAID") {
    return <Badge variant="outline" className="border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">지급 완료</Badge>;
  }
  if (status === "SUBMITTED") {
    return <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">신청 완료 · 지급 대기중</Badge>;
  }
  return <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">신청 대기중</Badge>;
}

function ClaimCard({
  initialClaim,
  canComplete,
  canDelete,
  onDeleted,
}: {
  initialClaim: ClaimItem;
  canComplete: boolean;
  canDelete: boolean;
  onDeleted: (id: string) => void;
}) {
  const [claim, setClaim] = useState(initialClaim);
  const [types, setTypes] = useState<InsuranceClaimType[]>(initialClaim.types);
  const [error, setError] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isReported = claim.status === "REPORTED";
  const isSubmitted = claim.status === "SUBMITTED";
  const isPaid = claim.status === "PAID";
  const isProcessed = isSubmitted || isPaid;
  const normalizedPaidAmount = Number(paidAmount);
  const isPaidAmountValid = /^\d+$/.test(paidAmount)
    && normalizedPaidAmount > 0
    && normalizedPaidAmount <= 2_000_000_000;

  const submit = () => startTransition(async () => {
    setError(null);
    const result = await submitInsuranceClaimAction({ id: claim.id, types });
    if (!result.success || !result.data) {
      setError(result.message || "신청 완료하지 못했습니다.");
      return;
    }
    setClaim((current) => ({
      ...current,
      status: "SUBMITTED",
      types: result.data!.types,
      submittedAt: new Date(result.data!.submittedAt),
      submittedByName: result.data!.submittedByName,
    }));
  });

  const completePayout = () => startTransition(async () => {
    setPayoutError(null);
    const result = await completeInsurancePayoutAction({ id: claim.id, paidAmount: normalizedPaidAmount });
    if (!result.success || !result.data) {
      setPayoutError(result.message || "지급 완료 처리하지 못했습니다.");
      return;
    }
    setClaim((current) => ({
      ...current,
      status: "PAID",
      paidAmount: result.data!.paidAmount,
      paidAt: new Date(result.data!.paidAt),
      paidByName: result.data!.paidByName,
    }));
    setPayoutOpen(false);
    setPaidAmount("");
  });

  const remove = () => startTransition(async () => {
    setError(null);
    const result = await deleteInsuranceClaimAction({ id: claim.id });
    if (!result.success) {
      setError(result.message || "삭제하지 못했습니다.");
      setDeleteOpen(false);
      return;
    }
    setDeleteOpen(false);
    onDeleted(claim.id);
  });

  return <>
    <article className="space-y-4 rounded-xl border bg-card p-4 shadow-sm" data-insurance-claim-id={claim.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{claim.property.name} · {claim.room.name}</h2>
          <p className="mt-1 text-xs text-muted-foreground">보고 {formatDateTime(claim.createdAt)} / {claim.reporterName}</p>
        </div>
        <ClaimStatusBadge status={claim.status} />
      </div>

      <p className="whitespace-pre-wrap text-sm leading-6">{claim.content}</p>

      <fieldset disabled={!isReported || pending || !canComplete} className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">신청 종류</legend>
        <div className="flex flex-wrap gap-2">
          {INSURANCE_CLAIM_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="checkbox"
                checked={types.includes(type)}
                onChange={() => setTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])}
              />
              {INSURANCE_CLAIM_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>

      {claim.photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto">
          {claim.photos.map((photo) => (
            <a key={photo.id} href={withBasePath(`/api/insurance-claims/photos/${encodeURIComponent(photo.id)}`)} target="_blank" rel="noreferrer" className="block shrink-0">
              <Image unoptimized width={80} height={80} src={withBasePath(`/api/insurance-claims/photos/${encodeURIComponent(photo.id)}`)} alt={photo.originalName} className="size-20 rounded-lg border object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Images className="size-4" />사진 없음</p>
      )}

      {claim.submittedAt && (
        <p className="text-xs text-muted-foreground">신청 완료 {formatDateTime(claim.submittedAt)} / {claim.submittedByName ?? "-"}</p>
      )}

      {isPaid && claim.paidAmount !== null && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">최종 지급 금액</p>
          <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">{formatPaidAmount(claim.paidAmount)}</p>
          <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
            지급 완료 {claim.paidAt ? formatDateTime(claim.paidAt) : ""} / {claim.paidByName ?? "-"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isReported && canComplete && (
          <Button type="button" disabled={pending || types.length === 0} onClick={submit}>
            {pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}선택 종류 신청 완료
          </Button>
        )}
        {isSubmitted && canComplete && (
          <Button type="button" disabled={pending} onClick={() => { setPayoutError(null); setPayoutOpen(true); }}>
            <CircleDollarSign />지급 완료
          </Button>
        )}
        {isProcessed && canDelete && (
          <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setDeleteOpen(true)}>
            <Trash2 />삭제
          </Button>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </article>

    <Dialog open={payoutOpen} onOpenChange={(open) => { if (!pending) { setPayoutOpen(open); if (!open) setPayoutError(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>지급 완료 처리</DialogTitle>
          <DialogDescription>보험 또는 OTA에서 실제 입금된 최종 금액을 입력해 주세요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`paid-amount-${claim.id}`}>지급 금액 (엔)</Label>
          <Input
            id={`paid-amount-${claim.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={2_000_000_000}
            step={1}
            value={paidAmount}
            onChange={(event) => setPaidAmount(event.target.value)}
            placeholder="예: 150000"
            disabled={pending}
            autoFocus
          />
          {isPaidAmountValid && <p className="text-xs text-muted-foreground">입력 금액: {formatPaidAmount(normalizedPaidAmount)}</p>}
          {payoutError && <p role="alert" className="text-sm text-destructive">{payoutError}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setPayoutOpen(false)}>취소</Button>
          <Button type="button" disabled={pending || !isPaidAmountValid} onClick={completePayout}>
            {pending ? <LoaderCircle className="animate-spin" /> : <CircleDollarSign />}지급 완료 저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteOpen} onOpenChange={(open) => { if (!pending) setDeleteOpen(open); }}>
      <DialogContent role="alertdialog" showCloseButton={!pending} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>보험/보상 기록을 삭제하시겠습니까?</DialogTitle>
          <DialogDescription>보험/보상 보고, 지급 정보와 등록된 사진이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</DialogDescription>
        </DialogHeader>
        <p className="rounded-lg border bg-muted/40 p-3 text-sm font-medium">
          {claim.property.name} · {claim.room.name}
          <span className="mt-1 block line-clamp-2 font-normal text-muted-foreground">{claim.content}</span>
        </p>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setDeleteOpen(false)}>취소</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={remove}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

export function InsuranceClaimList({
  claims,
  canComplete,
  canDelete,
}: {
  claims: ClaimItem[];
  canComplete: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(() => new Set());
  const items = claims.filter((claim) => !deletedIds.has(claim.id));
  const removeItem = (id: string) => {
    setDeletedIds((current) => new Set(current).add(id));
    router.refresh();
  };
  if (!items.length) return <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">등록된 보험/보상 보고가 없습니다.</div>;
  return <div className="grid gap-3 lg:grid-cols-2">{items.map((claim) => <ClaimCard key={claim.id} initialClaim={claim} canComplete={canComplete} canDelete={canDelete} onDeleted={removeItem} />)}</div>;
}
