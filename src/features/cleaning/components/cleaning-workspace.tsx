"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, Check, ChevronLeft, ChevronRight, LoaderCircle, Play, Sparkles, Upload } from "lucide-react";

import type { UserRole } from "@/features/access-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withBasePath } from "@/lib/base-path";
import { assignCleaningTaskAction, completeCleaningTaskAction, startCleaningTaskAction } from "../cleaning.actions";
import type { CleaningFilters, CleaningPageData, CleaningPhotoViewModel, CleaningTaskViewModel } from "../cleaning.types";
import { getCleaningDateInput, shiftCleaningDate } from "../domain/cleaning-date";

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
        {children}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: CleaningTaskViewModel["status"] }) {
  const t = useTranslations("cleaning.status");
  const variant = status === "COMPLETED" ? "default" : status === "IN_PROGRESS" ? "secondary" : status === "CANCELLED" ? "outline" : "secondary";
  return <Badge variant={variant}>{t(status)}</Badge>;
}

function PriorityBadge({ priority }: { priority: CleaningTaskViewModel["priority"] }) {
  const t = useTranslations("cleaning.priority");
  return <Badge variant={priority === "urgent" ? "destructive" : "outline"}>{t(priority)}</Badge>;
}

export function CleaningWorkspace({ filters, data, currentUserId, role }: { filters: CleaningFilters; data: CleaningPageData; currentUserId: string; role: UserRole }) {
  const t = useTranslations("cleaning");
  const common = useTranslations("common");
  const locale = useLocale();
  const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";
  const router = useRouter();
  const pathname = usePathname();
  const [selectedTask, setSelectedTask] = useState<CleaningTaskViewModel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateTime = useMemo(() => new Intl.DateTimeFormat(localeTag, {
    timeZone: "Asia/Tokyo",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }), [localeTag]);
  const day = useMemo(() => new Intl.DateTimeFormat(localeTag, {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
  }), [localeTag]);

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 2600);
  };

  const navigate = (patch: Partial<CleaningFilters>) => {
    const params = new URLSearchParams();
    const next = { ...filters, ...patch, page: patch.page ?? ("page" in patch ? patch.page : 1) };
    if (next.tab === "history") params.set("tab", "history");
    params.set("date", next.date);
    if (next.companyId) params.set("companyId", next.companyId);
    if (next.propertyId) params.set("propertyId", next.propertyId);
    if (next.roomId) params.set("roomId", next.roomId);
    if (next.assigneeId) params.set("assigneeId", next.assigneeId);
    if (next.status && next.tab === "ongoing") params.set("status", next.status);
    if (next.priority && next.tab === "ongoing") params.set("priority", next.priority);
    if (Number(next.page) > 1) params.set("page", String(next.page));
    startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
  };

  const runAction = (action: () => Promise<{ success: boolean; message: string }>) => {
    startTransition(async () => {
      const result = await action();
      showNotice(result.message);
      if (result.success) {
        setSelectedTask(null);
        router.refresh();
      }
    });
  };

  const companyProperties = data.properties.filter((property) => !filters.companyId || property.companyId === filters.companyId);
  const propertyRooms = data.rooms.filter((room) => !filters.propertyId || room.propertyId === filters.propertyId);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1" role="tablist" aria-label={t("tabs.label")}>
        {(["ongoing", "history"] as const).map((tab) => (
          <button key={tab} type="button" role="tab" aria-selected={filters.tab === tab} onClick={() => navigate({ tab, status: tab === "history" ? "COMPLETED" : null, priority: null })} className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${filters.tab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border bg-card p-3 sm:p-4" aria-label={common("filter")}>
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" aria-label={t("date.previous")} onClick={() => navigate({ date: shiftCleaningDate(filters.date, -1) })}><ChevronLeft /></Button>
          <div className="text-center">
            <p className="font-semibold">{day.format(new Date(`${filters.date}T00:00:00+09:00`))}</p>
            {filters.date !== getCleaningDateInput() && <button type="button" onClick={() => navigate({ date: getCleaningDateInput() })} className="text-xs font-medium text-primary hover:underline">{common("today")}</button>}
          </div>
          <Button variant="outline" size="icon" aria-label={t("date.next")} onClick={() => navigate({ date: shiftCleaningDate(filters.date, 1) })}><ChevronRight /></Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {data.companies.length > 1 && <SelectField label={t("filters.company")} value={filters.companyId ?? ""} onChange={(companyId) => navigate({ companyId: companyId || null, propertyId: null, roomId: null })}>
            <option value="">{t("filters.allCompanies")}</option>{data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </SelectField>}
          <SelectField label={common("property")} value={filters.propertyId ?? ""} onChange={(propertyId) => navigate({ propertyId: propertyId || null, roomId: null })}>
            <option value="">{t("filters.allProperties")}</option>{companyProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </SelectField>
          <SelectField label={common("room")} value={filters.roomId ?? ""} onChange={(roomId) => navigate({ roomId: roomId || null })}>
            <option value="">{t("filters.allRooms")}</option>{propertyRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </SelectField>
          <SelectField label={t("fields.assignee")} value={filters.assigneeId ?? ""} onChange={(assigneeId) => navigate({ assigneeId: assigneeId || null })}>
            <option value="">{t("filters.allAssignees")}</option><option value="unassigned">{t("unassigned")}</option>{data.assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
          </SelectField>
          {filters.tab === "ongoing" && <SelectField label={common("status")} value={filters.status ?? ""} onChange={(status) => navigate({ status: status === "PENDING" || status === "IN_PROGRESS" ? status : null })}>
            <option value="">{t("filters.allStatuses")}</option><option value="PENDING">{t("status.PENDING")}</option><option value="IN_PROGRESS">{t("status.IN_PROGRESS")}</option>
          </SelectField>}
          {filters.tab === "ongoing" && <SelectField label={t("fields.priority")} value={filters.priority ?? ""} onChange={(priority) => navigate({ priority: priority === "urgent" || priority === "flexible" ? priority : null })}>
            <option value="">{t("filters.allPriorities")}</option><option value="urgent">{t("priority.urgent")}</option><option value="flexible">{t("priority.flexible")}</option>
          </SelectField>}
        </div>
      </section>

      <div className="flex min-h-7 items-center justify-between gap-3">
        <p className="text-sm font-semibold">{t("resultCount", { count: data.totalCount })}</p>
        {isPending && <span className="flex items-center gap-1 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />{t("loading")}</span>}
      </div>

      {data.items.length ? <>
        <div className="hidden overflow-x-auto rounded-xl border md:block">
          <Table>
            <TableHeader><TableRow><TableHead>{t("fields.priority")}</TableHead><TableHead>{common("property")}</TableHead><TableHead>{common("room")}</TableHead><TableHead>{t("fields.checkout")}</TableHead><TableHead>{t("fields.nextCheckIn")}</TableHead><TableHead>{t("fields.assignee")}</TableHead><TableHead>{common("status")}</TableHead><TableHead>{t("fields.photoCount")}</TableHead><TableHead>{t("fields.startedAt")}</TableHead><TableHead className="text-right">{t("fields.actions")}</TableHead></TableRow></TableHeader>
            <TableBody>{data.items.map((task) => <TableRow key={task.id} className="cursor-pointer" onClick={() => setSelectedTask(task)}>
              <TableCell><PriorityBadge priority={task.priority} /></TableCell>
              <TableCell>{task.propertyName}</TableCell>
              <TableCell className="font-semibold">{task.roomName}</TableCell>
              <TableCell>{dateTime.format(new Date(task.scheduledDate))}</TableCell>
              <TableCell>{task.nextCheckInAt ? dateTime.format(new Date(task.nextCheckInAt)) : t("none")}</TableCell>
              <TableCell>{task.assignedTo?.name ?? t("unassigned")}</TableCell>
              <TableCell><StatusBadge status={task.status} /></TableCell>
              <TableCell>{t("photos.count", { count: task.photos.length })}</TableCell>
              <TableCell>{task.startedAt ? dateTime.format(new Date(task.startedAt)) : t("none")}</TableCell>
              <TableCell className="text-right"><Button variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); setSelectedTask(task); }}>{common("details")}</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="grid gap-3 md:hidden">{data.items.map((task) => <Card key={task.id} className="cursor-pointer" onClick={() => setSelectedTask(task)}><CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{task.roomName}</p><p className="text-xs text-muted-foreground">{task.propertyName}</p></div><StatusBadge status={task.status} /></div>
          <div className="grid grid-cols-2 gap-2 text-xs"><div><p className="text-muted-foreground">{t("fields.checkout")}</p><p className="mt-0.5 font-medium">{dateTime.format(new Date(task.scheduledDate))}</p></div><div><p className="text-muted-foreground">{t("fields.assignee")}</p><p className="mt-0.5 font-medium">{task.assignedTo?.name ?? t("unassigned")}</p></div><div><p className="text-muted-foreground">{t("fields.photoCount")}</p><p className="mt-0.5 font-medium">{t("photos.count", { count: task.photos.length })}</p></div><div><p className="text-muted-foreground">{t("fields.startedAt")}</p><p className="mt-0.5 font-medium">{task.startedAt ? dateTime.format(new Date(task.startedAt)) : t("none")}</p></div></div>
          <PriorityBadge priority={task.priority} />
        </CardContent></Card>)}</div>
      </> : <div className="rounded-xl border border-dashed px-6 py-14 text-center"><Sparkles className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-semibold">{filters.tab === "history" ? t("emptyHistory") : t("emptyOngoing")}</p><p className="mt-1 text-sm text-muted-foreground">{t("emptyDescription")}</p></div>}

      {data.totalPages > 1 && <nav className="flex items-center justify-center gap-2" aria-label={t("pagination.label")}>
        <Button variant="outline" size="sm" disabled={data.page <= 1 || isPending} onClick={() => navigate({ page: data.page - 1 })}>{t("pagination.previous")}</Button>
        <span className="text-sm font-medium">{t("pagination.current", { page: data.page, total: data.totalPages })}</span>
        <Button variant="outline" size="sm" disabled={data.page >= data.totalPages || isPending} onClick={() => navigate({ page: data.page + 1 })}>{t("pagination.next")}</Button>
      </nav>}

      <CleaningTaskDialog key={selectedTask?.id ?? "empty"} task={selectedTask} role={role} currentUserId={currentUserId} localeTag={localeTag} pending={isPending} onClose={() => setSelectedTask(null)} onNotice={showNotice} onRefresh={() => router.refresh()} onAction={runAction} />
      {notice && <div className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-sm rounded-lg bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg lg:bottom-6" role="status" aria-live="polite">{notice}</div>}
    </div>
  );
}

function CleaningTaskDialog({ task, role, currentUserId, localeTag, pending, onClose, onNotice, onRefresh, onAction }: { task: CleaningTaskViewModel | null; role: UserRole; currentUserId: string; localeTag: string; pending: boolean; onClose: () => void; onNotice: (message: string) => void; onRefresh: () => void; onAction: (action: () => Promise<{ success: boolean; message: string }>) => void }) {
  const t = useTranslations("cleaning");
  const [photos, setPhotos] = useState<CleaningPhotoViewModel[]>(task?.photos ?? []);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const actionable = task?.status === "PENDING" || task?.status === "IN_PROGRESS";
  const staffCanManage = role !== "STAFF" || !task?.assignedTo || task.assignedTo.id === currentUserId;
  const canComplete = Boolean(task && photos.some((photo) => photo.url) && (role !== "STAFF" || !task.assignedTo || task.assignedTo.id === currentUserId));
  const dateTime = new Intl.DateTimeFormat(localeTag, { timeZone: "Asia/Tokyo", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const retentionDate = photos.find((photo) => photo.deleteAfter)?.deleteAfter;

  const uploadPhoto = (file: File) => {
    if (!task) return;
    const formData = new FormData();
    formData.set("photo", file);
    const xhr = new XMLHttpRequest();
    setUploadProgress(0);
    xhr.open("POST", withBasePath(`/api/cleaning/tasks/${task.id}/photos`));
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploadProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText) as { success: boolean; message: string; photo?: { id: string; url: string } };
        onNotice(result.message);
        if (xhr.status >= 200 && xhr.status < 300 && result.photo) {
          setPhotos((current) => [...current, { id: result.photo!.id, url: result.photo!.url, mimeType: file.type, size: file.size, originalName: file.name, createdAt: new Date().toISOString(), deleteAfter: null, deletedAt: null }]);
          onRefresh();
        }
      } catch { onNotice(t("messages.uploadFailed")); }
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    };
    xhr.onerror = () => { setUploadProgress(null); onNotice(t("messages.uploadFailed")); };
    xhr.send(formData);
  };

  return <Dialog open={Boolean(task)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-2xl">
      {task && <>
        <DialogHeader><DialogTitle>{t("details.title", { room: task.roomName })}</DialogTitle><DialogDescription>{task.propertyName} · {dateTime.format(new Date(task.scheduledDate))}</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex flex-wrap gap-2"><StatusBadge status={task.status} /><PriorityBadge priority={task.priority} /></div>
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("fields.company")}</dt><dd>{task.companyName}</dd>
              <dt className="text-muted-foreground">{t("fields.assignee")}</dt><dd>{task.assignedTo?.name ?? t("unassigned")}</dd>
              <dt className="text-muted-foreground">{t("fields.nextCheckIn")}</dt><dd>{task.nextCheckInAt ? dateTime.format(new Date(task.nextCheckInAt)) : t("none")}</dd>
              <dt className="text-muted-foreground">{t("details.reservation")}</dt><dd>{task.reservation?.guestName || task.reservation?.summary || t("details.reservationFallback")}</dd>
              <dt className="text-muted-foreground">{t("fields.startedAt")}</dt><dd>{task.startedAt ? dateTime.format(new Date(task.startedAt)) : t("none")}</dd>
              {task.completedBy && <><dt className="text-muted-foreground">{t("fields.completedBy")}</dt><dd>{task.completedBy.name}</dd></>}
              {task.completedAt && <><dt className="text-muted-foreground">{t("fields.completedAt")}</dt><dd>{dateTime.format(new Date(task.completedAt))}</dd></>}
            </dl>
          </div>
          <div className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between"><p className="font-semibold">{t("photos.title")}</p><span className="text-xs text-muted-foreground">{t("photos.count", { count: photos.length })}</span></div>
            {photos.length ? <div className="grid grid-cols-2 gap-2">{photos.map((photo) => photo.url ? <div key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted"><Image unoptimized src={photo.url} alt={t("photos.alt")} fill sizes="(max-width: 640px) 45vw, 240px" className="object-cover" /></div> : <div key={photo.id} className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted px-2 text-center text-xs text-muted-foreground">{t("photos.deleted")}</div>)}</div> : <p className="rounded-lg bg-muted/60 px-3 py-6 text-center text-sm text-muted-foreground">{t("photos.required")}</p>}
            {task.status === "COMPLETED" && <p className="text-xs text-muted-foreground">{photos.some((photo) => photo.url) ? retentionDate ? t("photos.retention", { date: dateTime.format(new Date(retentionDate)) }) : t("photos.retentionPending") : t("photos.deletedDescription")}</p>}
            {actionable && staffCanManage && <>
              <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadPhoto(file); }} />
              <Button type="button" variant="outline" className="w-full" disabled={uploadProgress !== null || pending} onClick={() => inputRef.current?.click()}>{uploadProgress === null ? <><Camera />{t("photos.upload")}</> : <><Upload className="animate-pulse" />{t("photos.uploading", { progress: uploadProgress })}</>}</Button>
            </>}
          </div>
        </div>
        {actionable && <div className="space-y-3 border-t pt-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>{t("fields.assignee")}</span><select value={task.assignedTo?.id ?? ""} disabled={pending || (role === "STAFF" && !staffCanManage)} onChange={(event) => onAction(() => assignCleaningTaskAction({ taskId: task.id, assignedToId: event.target.value || null }))} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50">
            <option value="">{t("unassigned")}</option>
            {(role === "STAFF" ? [{ id: currentUserId, name: t("self") }] : task.eligibleAssignees).map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
          </select></label>
          <div className="grid gap-2 sm:grid-cols-2">
            {task.status === "PENDING" && <Button variant="outline" disabled={pending || !staffCanManage} onClick={() => onAction(() => startCleaningTaskAction({ taskId: task.id }))}><Play />{t("actions.start")}</Button>}
            <Button disabled={pending || uploadProgress !== null || !canComplete} onClick={() => onAction(() => completeCleaningTaskAction({ taskId: task.id }))}><Check />{t("actions.complete")}</Button>
          </div>
          {!photos.some((photo) => photo.url) && <p className="text-center text-xs text-muted-foreground">{t("photos.completeHint")}</p>}
        </div>}
      </>}
    </DialogContent>
  </Dialog>;
}
