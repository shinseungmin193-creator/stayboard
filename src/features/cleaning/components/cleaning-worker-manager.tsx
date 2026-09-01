"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createCleaningWorkerAction,
  setCleaningWorkerActiveAction,
  updateCleaningWorkerAction,
} from "../cleaning-worker.actions";
import type { CleaningWorkerViewModel } from "../cleaning.types";

export function CleaningWorkerManager({
  companies,
  initialWorkers,
  onNotice,
}: {
  companies: Array<{ id: string; name: string }>;
  initialWorkers: CleaningWorkerViewModel[];
  onNotice: (message: string) => void;
}) {
  const t = useTranslations("cleaning.workers");
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState(initialWorkers);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pending, startTransition] = useTransition();

  const updateLocal = (worker: CleaningWorkerViewModel) => {
    setWorkers((current) => {
      const exists = current.some((item) => item.id === worker.id);
      const next = exists ? current.map((item) => item.id === worker.id ? worker : item) : [...current, worker];
      return next.sort((left, right) => left.companyName.localeCompare(right.companyName, "ko") || Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name, "ko"));
    });
  };

  const create = () => {
    if (!companyId || !newName.trim()) return;
    startTransition(async () => {
      const result = await createCleaningWorkerAction({ companyId, name: newName });
      onNotice(result.message ?? "");
      if (result.success && result.data) {
        updateLocal(result.data);
        setNewName("");
      }
    });
  };

  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><UserRoundCog />{t("manage")}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {companies.length > 1 && <select value={companyId} onChange={(event) => setCompanyId(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
            {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>}
          <div className="flex gap-2">
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={30} placeholder={t("namePlaceholder")} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); create(); } }} />
            <Button type="button" disabled={pending || !companyId || !newName.trim()} onClick={create}>{t("add")}</Button>
          </div>
        </div>
        <div className="max-h-[52dvh] space-y-2 overflow-y-auto">
          {workers.map((worker) => <div key={worker.id} className="rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{worker.name}</p>
                <p className="text-xs text-muted-foreground">{worker.companyName} · {worker.isActive ? t("active") : t("inactive")}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="xs" disabled={pending} onClick={() => { setEditingId(worker.id); setEditingName(worker.name); }}>{t("edit")}</Button>
                <Button type="button" variant={worker.isActive ? "destructive" : "outline"} size="xs" disabled={pending} onClick={() => startTransition(async () => {
                  const result = await setCleaningWorkerActiveAction({ id: worker.id, isActive: !worker.isActive });
                  onNotice(result.message ?? "");
                  if (result.success && result.data) updateLocal({ ...result.data, companyName: result.data.companyName || worker.companyName });
                })}>{worker.isActive ? t("deactivate") : t("activate")}</Button>
              </div>
            </div>
            {editingId === worker.id && <div className="mt-3 flex gap-2 border-t pt-3">
              <Input value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={30} />
              <Button type="button" size="sm" disabled={pending || !editingName.trim()} onClick={() => startTransition(async () => {
                const result = await updateCleaningWorkerAction({ id: worker.id, name: editingName });
                onNotice(result.message ?? "");
                if (result.success && result.data) {
                  updateLocal(result.data);
                  setEditingId(null);
                }
              })}>{t("save")}</Button>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditingId(null)}>{t("cancel")}</Button>
            </div>}
          </div>)}
          {!workers.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
