"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, CircleCheck, ImagePlus, LoaderCircle, RotateCcw, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import {
  CLEANING_PHOTO_ACCEPT,
  CLEANING_PHOTO_MIME_TYPES,
  MAX_CLEANING_PHOTO_SIZE,
} from "../domain/cleaning-photo-validation";
import type { CleaningActionResult } from "../cleaning.actions";
import type { CleaningPhotoViewModel } from "../cleaning.types";

type UploadStatus = "selected" | "uploading" | "uploaded" | "failed";

interface UploadItem {
  uploadId: string;
  fingerprint: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  message: string | null;
  uploadable: boolean;
}

export interface CleaningPhotoUploadState {
  persistedPhotoCount: number;
  hasUnuploadedFiles: boolean;
  hasFailedFiles: boolean;
  isUploading: boolean;
  readyForCompletion: boolean;
}

interface UploadResponse extends CleaningActionResult {
  photo?: CleaningPhotoViewModel;
}

function createUploadId() {
  return crypto.randomUUID();
}

function fileFingerprint(file: File) {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function uploadPhotoRequest(input: {
  taskId: string;
  item: UploadItem;
  onProgress(progress: number): void;
  register(xhr: XMLHttpRequest | null): void;
  fallbackMessage: string;
  statusMessages: Partial<Record<number, string>>;
}): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("photo", input.item.file);
    const xhr = new XMLHttpRequest();
    input.register(xhr);
    xhr.open("POST", withBasePath(`/api/cleaning/tasks/${input.taskId}/photos`));
    xhr.setRequestHeader("X-Cleaning-Upload-Id", input.item.uploadId);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      input.register(null);
      let response: UploadResponse | null = null;
      try {
        response = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        response = null;
      }
      if (xhr.status >= 200 && xhr.status < 300 && response?.success && response.photo?.id) {
        resolve(response);
        return;
      }
      reject(new Error(response?.message || input.statusMessages[xhr.status] || input.fallbackMessage));
    };
    xhr.onerror = () => { input.register(null); reject(new Error(input.fallbackMessage)); };
    xhr.ontimeout = () => { input.register(null); reject(new Error(input.fallbackMessage)); };
    xhr.onabort = () => { input.register(null); reject(new Error(input.fallbackMessage)); };
    xhr.send(formData);
  });
}

export function CleaningPhotoUploader({
  taskId,
  initialPhotos,
  disabled = false,
  readOnly = false,
  onResult,
  onUploaded,
  onStateChange,
}: {
  taskId: string;
  initialPhotos: readonly CleaningPhotoViewModel[];
  disabled?: boolean;
  readOnly?: boolean;
  onResult(result: CleaningActionResult): void;
  onUploaded?(photo: CleaningPhotoViewModel): void;
  onStateChange?(state: CleaningPhotoUploadState): void;
}) {
  const t = useTranslations("cleaning");
  const captureInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const activeRequestRef = useRef<XMLHttpRequest | null>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const [uploadedPhotos, setUploadedPhotos] = useState<CleaningPhotoViewModel[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputInstanceId = useId().replace(/:/g, "");
  const safeTaskId = taskId.replace(/[^A-Za-z0-9_-]/g, "-");
  const captureInputId = `cleaning-photo-capture-${safeTaskId}-${inputInstanceId}`;
  const galleryInputId = `cleaning-photo-gallery-${safeTaskId}-${inputInstanceId}`;
  const pickerDisabled = disabled || isUploading;

  useEffect(() => () => {
    activeRequestRef.current?.abort();
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current.clear();
  }, []);

  const photos = useMemo(() => {
    const merged = new Map(initialPhotos.map((photo) => [photo.id, photo]));
    for (const photo of uploadedPhotos) if (!merged.has(photo.id)) merged.set(photo.id, photo);
    return [...merged.values()];
  }, [initialPhotos, uploadedPhotos]);
  const activePhotos = useMemo(() => photos.filter((photo) => photo.url && !photo.deletedAt), [photos]);
  const deletedPhotos = useMemo(() => photos.filter((photo) => !photo.url || photo.deletedAt), [photos]);
  const hasUnuploadedFiles = items.some((item) => item.status === "selected" || item.status === "uploading");
  const hasFailedFiles = items.some((item) => item.status === "failed");
  const readyForCompletion = activePhotos.length > 0 && !hasUnuploadedFiles && !hasFailedFiles && !isUploading;

  useEffect(() => {
    onStateChange?.({
      persistedPhotoCount: activePhotos.length,
      hasUnuploadedFiles,
      hasFailedFiles,
      isUploading,
      readyForCompletion,
    });
  }, [activePhotos.length, hasFailedFiles, hasUnuploadedFiles, isUploading, onStateChange, readyForCompletion]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setItems((current) => {
      const known = new Set(current.map((item) => item.fingerprint));
      const additions: UploadItem[] = [];
      for (const file of Array.from(files)) {
        const fingerprint = fileFingerprint(file);
        if (known.has(fingerprint)) continue;
        known.add(fingerprint);
        const normalizedType = file.type.trim().toLowerCase() === "image/jpg" ? "image/jpeg" : file.type.trim().toLowerCase();
        const typeAllowed = !normalizedType || CLEANING_PHOTO_MIME_TYPES.includes(normalizedType as (typeof CLEANING_PHOTO_MIME_TYPES)[number]);
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        const uploadable = file.size > 0 && file.size <= MAX_CLEANING_PHOTO_SIZE && typeAllowed;
        additions.push({
          uploadId: createUploadId(),
          fingerprint,
          file,
          previewUrl,
          status: uploadable ? "selected" : "failed",
          progress: 0,
          message: file.size > MAX_CLEANING_PHOTO_SIZE
            ? t("messages.photoTooLarge")
            : file.size <= 0
              ? t("messages.photoEmpty")
              : !typeAllowed
                ? t("messages.photoInvalidType")
                : null,
          uploadable,
        });
      }
      return [...current, ...additions];
    });
    if (captureInputRef.current) captureInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const updateItem = (uploadId: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => item.uploadId === uploadId ? { ...item, ...patch } : item));
  };

  const removeItem = (uploadId: string) => {
    setItems((current) => {
      const item = current.find((candidate) => candidate.uploadId === uploadId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
      return current.filter((candidate) => candidate.uploadId !== uploadId);
    });
  };

  const uploadSelected = async () => {
    const targets = items.filter((item) => item.uploadable && (item.status === "selected" || item.status === "failed"));
    if (!targets.length || disabled || isUploading) return;
    setIsUploading(true);
    for (const item of targets) {
      if (item.file.size <= 0 || item.file.size > MAX_CLEANING_PHOTO_SIZE) continue;
      updateItem(item.uploadId, { status: "uploading", progress: 0, message: null });
      try {
        const result = await uploadPhotoRequest({
          taskId,
          item,
          onProgress: (progress) => updateItem(item.uploadId, { progress }),
          register: (xhr) => { activeRequestRef.current = xhr; },
          fallbackMessage: t("messages.uploadFailed"),
          statusMessages: {
            400: t("messages.invalidRequest"),
            401: t("messages.forbidden"),
            403: t("messages.forbidden"),
            404: t("messages.notFound"),
            409: t("messages.notActionable"),
            413: t("messages.photoTooLarge"),
            415: t("messages.photoInvalidType"),
          },
        });
        const photo = result.photo!;
        setUploadedPhotos((current) => current.some((candidate) => candidate.id === photo.id) ? current : [...current, photo]);
        removeItem(item.uploadId);
        onResult({ success: true, message: result.message });
        onUploaded?.(photo);
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : t("messages.uploadFailed");
        updateItem(item.uploadId, { status: "failed", message });
        onResult({ success: false, message });
      }
    }
    setIsUploading(false);
  };

  return <div className="space-y-3">
    {activePhotos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {activePhotos.map((photo) => <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        <Image unoptimized src={photo.url!} alt={t("photos.alt")} fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover" />
        <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 p-1 text-white"><CircleCheck className="size-3.5" /></span>
      </div>)}
    </div>}

    {deletedPhotos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{deletedPhotos.map((photo) => <div key={photo.id} className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted px-2 text-center text-xs text-muted-foreground">{t("photos.deleted")}</div>)}</div>}

    {items.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => <div key={item.uploadId} className="space-y-1.5">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          <Image unoptimized src={item.previewUrl} alt={item.file.name} fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover" />
          {item.status === "uploading" && <div className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white"><LoaderCircle className="mb-1 size-5 animate-spin" />{item.progress}%</div>}
          {item.status === "uploaded" && <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 p-1 text-white"><CircleCheck className="size-3.5" /></span>}
          {(item.status === "selected" || item.status === "failed") && <button type="button" className="absolute right-1.5 top-1.5 rounded-full bg-black/65 p-1 text-white" aria-label={t("photos.removeSelected")} onClick={() => removeItem(item.uploadId)} disabled={disabled || isUploading}><Trash2 className="size-3.5" /></button>}
        </div>
        <p className={cn("truncate text-xs", item.status === "failed" ? "text-destructive" : "text-muted-foreground")}>{item.message || item.file.name}</p>
      </div>)}
    </div>}

    {!activePhotos.length && !items.length && <p className="rounded-xl bg-muted/50 px-3 py-5 text-center text-sm text-muted-foreground">{t("photos.required")}</p>}

    {!readOnly && <>
      <input id={captureInputId} data-cleaning-photo-input={`${taskId}:camera`} ref={captureInputRef} type="file" accept={CLEANING_PHOTO_ACCEPT} capture="environment" className="sr-only" disabled={pickerDisabled} onChange={(event) => addFiles(event.target.files)} />
      <input id={galleryInputId} data-cleaning-photo-input={`${taskId}:gallery`} ref={galleryInputRef} type="file" accept={CLEANING_PHOTO_ACCEPT} multiple className="sr-only" disabled={pickerDisabled} onChange={(event) => addFiles(event.target.files)} />
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={captureInputId} data-cleaning-photo-trigger={`${taskId}:camera`} aria-disabled={pickerDisabled} className={cn(buttonVariants({ variant: "outline" }), pickerDisabled ? "pointer-events-none opacity-50" : "cursor-pointer")}><Camera />{t("photos.capture")}</label>
        <label htmlFor={galleryInputId} data-cleaning-photo-trigger={`${taskId}:gallery`} aria-disabled={pickerDisabled} className={cn(buttonVariants({ variant: "outline" }), pickerDisabled ? "pointer-events-none opacity-50" : "cursor-pointer")}><ImagePlus />{t("photos.select")}</label>
      </div>
      {items.some((item) => item.uploadable && (item.status === "selected" || item.status === "failed")) && <Button type="button" className="w-full" disabled={disabled || isUploading} onClick={uploadSelected}>
        {isUploading ? <><LoaderCircle className="animate-spin" />{t("photos.uploadingFiles")}</> : hasFailedFiles ? <><RotateCcw />{t("photos.retryUpload")}</> : <><Upload />{t("photos.uploadSelected")}</>}
      </Button>}
      <p className="text-xs text-muted-foreground">{t("photos.fileGuide")}</p>
    </>}
  </div>;
}
