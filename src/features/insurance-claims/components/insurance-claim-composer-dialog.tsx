"use client";

import { useState, useTransition } from "react";
import { Camera, LoaderCircle, ShieldPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CLEANING_PHOTO_ACCEPT, isSupportedCleaningPhotoSelection, MAX_CLEANING_PHOTO_SIZE } from "@/features/cleaning/domain/cleaning-photo-validation";
import { withBasePath } from "@/lib/base-path";
import { createClientOperationId } from "@/lib/client-operation-id";
import { createInsuranceClaimAction } from "../insurance-claim.actions";

export interface InsuranceClaimComposerRoom { id: string; propertyId: string; propertyName: string; name: string }

export function InsuranceClaimComposerDialog({ room, open, onOpenChange, onCreated }: {
  room: InsuranceClaimComposerRoom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (roomId: string) => void;
}) {
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => { setContent(""); setPhotos([]); setError(null); };
  const changeOpen = (next: boolean) => { if (!next) reset(); onOpenChange(next); };
  const submit = () => {
    if (!room || !content.trim()) return;
    const target = room;
    setError(null);
    startTransition(async () => {
      const result = await createInsuranceClaimAction({ propertyId: target.propertyId, roomId: target.id, content });
      if (!result.success || !result.data) { setError(result.message || "등록하지 못했습니다."); return; }
      let photoUploadFailed = false;
      for (const photo of photos) {
        const body = new FormData();
        body.set("photo", photo);
        const response = await fetch(withBasePath(`/api/insurance-claims/${encodeURIComponent(result.data.id)}/photos`), { method: "POST", headers: { "X-Insurance-Claim-Upload-Id": createClientOperationId("insurance-photo") }, body });
        if (!response.ok) photoUploadFailed = true;
      }
      onCreated?.(target.id);
      if (photoUploadFailed) { setError("보고는 등록했지만 일부 사진을 업로드하지 못했습니다. 다시 보고하지 말고 관리자에게 확인해 주세요."); return; }
      changeOpen(false);
    });
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!pending) changeOpen(next); }}>
    <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ShieldPlus className="size-5" />보험/보상 보고</DialogTitle>
        <DialogDescription>{room ? `${room.propertyName} ${room.name}` : "객실의 사고 또는 보상 내용을 보고합니다."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="insurance-claim-content">보고 내용</Label>
        <textarea id="insurance-claim-content" value={content} onChange={(event) => setContent(event.target.value)} rows={6} maxLength={2000} disabled={pending} className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30" placeholder="발생 내용, 피해 상태, 필요한 조치를 입력하세요." />
        <p className="text-right text-xs text-muted-foreground">{content.length}/2000</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="insurance-claim-photos">사진 (선택 · 없어도 등록 가능, 최대 12장)</Label>
        <input id="insurance-claim-photos" type="file" accept={CLEANING_PHOTO_ACCEPT} multiple disabled={pending} className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold" onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          const valid = selected.filter((file) => file.size <= MAX_CLEANING_PHOTO_SIZE && isSupportedCleaningPhotoSelection({ declaredMimeType: file.type, fileName: file.name }));
          if (selected.length > 12 || valid.length !== selected.length) { setError(selected.length > 12 ? "사진은 최대 12장까지 등록할 수 있습니다." : "지원하지 않는 사진 형식이거나 용량이 너무 큽니다."); event.target.value = ""; return; }
          setError(null); setPhotos(valid);
        }} />
        {photos.length > 0 && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Camera className="size-3.5" />사진 {photos.length}장 선택됨</p>}
        {photos.length === 0 && <p className="text-xs text-muted-foreground">사진을 선택하지 않아도 보고할 수 있습니다.</p>}
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>취소</Button>
        <Button type="button" disabled={pending || !content.trim()} onClick={submit}>{pending ? <LoaderCircle className="animate-spin" /> : <ShieldPlus />}보고 등록</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
