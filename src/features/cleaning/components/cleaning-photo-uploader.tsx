"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, CircleCheck, ImagePlus, LoaderCircle, RotateCcw, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { cn } from "@/lib/utils";
import {
  CLEANING_PHOTO_ACCEPT,
  isSupportedCleaningPhotoSelection,
  MAX_CLEANING_PHOTO_SIZE,
} from "../domain/cleaning-photo-validation";
import { snapshotCleaningPhotoFiles } from "../domain/cleaning-photo-selection";
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
  const uploadInFlightRef = useRef(false);
  const previewUrlsRef = useRef(new Set<string>());
  const [uploadedPhotos, setUploadedPhotos] = useState<CleaningPhotoViewModel[]>([]);
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
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
  const activePhotos = useMemo(() => photos.filter((photo) => photo.url && !photo.deletedAt && !deletedPhotoIds.has(photo.id)), [deletedPhotoIds, photos]);
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

  const commitItems = (update: (current: UploadItem[]) => UploadItem[]) => {
    const next = update(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  };

  const updateItem = (uploadId: string, patch: Partial<UploadItem>) => {
    commitItems((current) => current.map((item) => item.uploadId === uploadId ? { ...item, ...patch } : item));
  };

  const removeItem = (uploadId: string) => {
    commitItems((current) => {
      const item = current.find((candidate) => candidate.uploadId === uploadId);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrlsRef.current.delete(item.previewUrl);
      }
      return current.filter((candidate) => candidate.uploadId !== uploadId);
    });
  };

  const uploadQueuedItems = async () => {
    if (disabled || uploadInFlightRef.current) return;
    const attempted = new Set<string>();
    uploadInFlightRef.current = true;
    setIsUploading(true);
    try {
      while (true) {
        const item = itemsRef.current.find((candidate) => candidate.uploadable
          && (candidate.status === "selected" || candidate.status === "failed")
          && !attempted.has(candidate.uploadId));
        if (!item) break;
        attempted.add(item.uploadId);
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
    } finally {
      uploadInFlightRef.current = false;
      setIsUploading(false);
    }
  };

  const addFiles = (files: readonly File[]) => {
    if (!files.length || disabled) return;
    const known = new Set(itemsRef.current.map((item) => item.fingerprint));
    const additions: UploadItem[] = [];
    for (const file of files) {
      const fingerprint = fileFingerprint(file);
      if (known.has(fingerprint)) continue;
      known.add(fingerprint);
      const typeAllowed = isSupportedCleaningPhotoSelection({ declaredMimeType: file.type, fileName: file.name });
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
    if (!additions.length) return;
    commitItems((current) => [...current, ...additions]);
    if (additions.some((item) => item.uploadable)) void uploadQueuedItems();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = snapshotCleaningPhotoFiles(event.currentTarget.files);
    event.currentTarget.value = "";
    addFiles(files);
  };

  const deleteStoredPhoto = async (photo: CleaningPhotoViewModel) => {
    if (disabled || isUploading) return;
    try {
      const response = await fetch(withBasePath(`/api/cleaning/photos/${encodeURIComponent(photo.id)}`), { method: "DELETE" });
      if (!response.ok) throw new Error();
      setDeletedPhotoIds((current) => new Set(current).add(photo.id));
      onResult({ success: true, message: t("messages.photoDeleted") });
    } catch {
      onResult({ success: false, message: t("messages.deleteFailed") });
    }
  };

  return <div className="space-y-3">
    {activePhotos.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {activePhotos.map((photo) => <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
        <Image unoptimized src={photo.url!} alt={t("photos.alt")} fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover" />
        <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 p-1 text-white"><CircleCheck className="size-3.5" /></span>
        {!readOnly && <button type="button" className="absolute bottom-1.5 right-1.5 grid min-h-11 min-w-11 place-items-center rounded-full bg-black/70 text-white" aria-label={t("photos.deleteStored")} disabled={disabled || isUploading} onClick={() => deleteStoredPhoto(photo)}><Trash2 className="size-4" /></button>}
      </div>)}
    </div>}

    {activePhotos.length > 0 && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{t("photos.registeredCount", { count: activePhotos.length })}</p>}

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
      <input id={captureInputId} data-cleaning-photo-input={`${taskId}:camera`} ref={captureInputRef} type="file" accept={CLEANING_PHOTO_ACCEPT} capture="environment" className="sr-only" disabled={pickerDisabled} onChange={handleFileInputChange} />
      <input id={galleryInputId} data-cleaning-photo-input={`${taskId}:gallery`} ref={galleryInputRef} type="file" accept={CLEANING_PHOTO_ACCEPT} multiple className="sr-only" disabled={pickerDisabled} onChange={handleFileInputChange} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" data-cleaning-photo-trigger={`${taskId}:camera`} aria-controls={captureInputId} disabled={pickerDisabled} onClick={() => captureInputRef.current?.click()}><Camera />{t("photos.capture")}</Button>
        <Button type="button" variant="outline" data-cleaning-photo-trigger={`${taskId}:gallery`} aria-controls={galleryInputId} disabled={pickerDisabled} onClick={() => galleryInputRef.current?.click()}><ImagePlus />{t("photos.select")}</Button>
      </div>
      {isUploading && <p role="status" aria-live="polite" className="flex items-center justify-center gap-2 text-sm font-medium"><LoaderCircle className="size-4 animate-spin" />{t("photos.uploadingFiles")}</p>}
      {items.some((item) => item.uploadable && (item.status === "selected" || item.status === "failed")) && <Button type="button" className="w-full" disabled={disabled || isUploading} onClick={uploadQueuedItems}>
        {isUploading ? <><LoaderCircle className="animate-spin" />{t("photos.uploadingFiles")}</> : hasFailedFiles ? <><RotateCcw />{t("photos.retryUpload")}</> : <><Upload />{t("photos.uploadSelected")}</>}
      </Button>}
      <p className="text-xs text-muted-foreground">{t("photos.fileGuide")}</p>
    </>}
  </div>;
}
