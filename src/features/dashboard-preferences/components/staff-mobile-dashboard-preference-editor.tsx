"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, RotateCcw, Save, Smartphone, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_CARD_BY_ID,
  type DashboardCardId,
} from "@/features/dashboard/dashboard-card-policy";
import { dashboardStatIconMap } from "@/features/dashboard/dashboard-stat-icons";
import { startDeveloperRoleSessionAction } from "@/features/developer-role-switch/developer-role-switch.actions";
import { useDeveloperRoleSwitch } from "@/features/developer-role-switch/components/developer-role-switch-provider";
import {
  resetStaffMobileDashboardPreferenceAction,
  saveStaffMobileDashboardPreferenceAction,
} from "../dashboard-preference.actions";
import type { DashboardPreferenceValue } from "../domain/dashboard-preference";

export interface StaffMobileDashboardPreferenceEditorData {
  companies: readonly { id: string; name: string }[];
  selectedCompanyId: string | null;
  selectedCompanyName: string | null;
  preference: DashboardPreferenceValue;
}

function samePreference(left: DashboardPreferenceValue, right: DashboardPreferenceValue) {
  return left.cardOrder.join("|") === right.cardOrder.join("|")
    && left.hiddenCardIds.join("|") === right.hiddenCardIds.join("|");
}

function SortableDashboardCard({
  id,
  position,
  hidden,
  onToggle,
}: {
  id: DashboardCardId;
  position: number;
  hidden: boolean;
  onToggle(): void;
}) {
  const t = useTranslations();
  const preferenceT = useTranslations("dashboardPreferences");
  const card = DASHBOARD_CARD_BY_ID[id];
  const Icon = dashboardStatIconMap[card.iconName];
  const label = t(card.labelKey);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return <div ref={setNodeRef} style={style} className={cn("flex min-h-14 items-center gap-2 rounded-lg border bg-background px-2.5 py-2 transition-[opacity,box-shadow]", hidden && "opacity-50", isDragging && "z-10 shadow-md ring-2 ring-primary/30")}>
    <span className="w-7 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground" aria-label={preferenceT("position", { position })}>{String(position).padStart(2, "0")}</span>
    <button type="button" className="grid size-8 shrink-0 touch-none cursor-grab place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring" aria-label={preferenceT("dragHandle", { label })} {...attributes} {...listeners}>
      <GripVertical className="size-4" />
    </button>
    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
    <button type="button" role="switch" aria-checked={!hidden} aria-label={preferenceT(hidden ? "showCard" : "hideCard", { label })} onClick={onToggle} className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", hidden ? "bg-muted text-muted-foreground" : "border-primary/30 bg-primary/10 text-primary")}>
      {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      <span className="hidden sm:inline">{preferenceT(hidden ? "hidden" : "visible")}</span>
    </button>
  </div>;
}

export function StaffMobileDashboardPreferenceEditor({ data }: { data: StaffMobileDashboardPreferenceEditorData }) {
  const t = useTranslations("dashboardPreferences");
  const router = useRouter();
  const roleSwitch = useDeveloperRoleSwitch();
  const [saved, setSaved] = useState<DashboardPreferenceValue>(data.preference);
  const [draft, setDraft] = useState<DashboardPreferenceValue>(data.preference);
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = !samePreference(saved, draft);
  const visibleCount = draft.cardOrder.length - draft.hiddenCardIds.length;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectCompany = (companyId: string) => {
    if (companyId === data.selectedCompanyId) return;
    if (dirty && !window.confirm(t("unsavedCompanyChange"))) return;
    router.push(`/developer/settings?staffMobileCompanyId=${encodeURIComponent(companyId)}`);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setMessage(null);
    setDraft((current) => {
      const oldIndex = current.cardOrder.indexOf(active.id as DashboardCardId);
      const newIndex = current.cardOrder.indexOf(over.id as DashboardCardId);
      return { ...current, cardOrder: arrayMove(current.cardOrder, oldIndex, newIndex) };
    });
  };
  const toggle = (id: DashboardCardId) => {
    setMessage(null);
    setDraft((current) => {
      const hidden = current.hiddenCardIds.includes(id);
      if (!hidden && current.cardOrder.length - current.hiddenCardIds.length === 1) {
        setMessageError(true);
        setMessage(t("messages.atLeastOneVisible"));
        return current;
      }
      return {
        ...current,
        hiddenCardIds: hidden
          ? current.hiddenCardIds.filter((cardId) => cardId !== id)
          : [...current.hiddenCardIds, id],
      };
    });
  };
  const save = () => startTransition(async () => {
    if (!data.selectedCompanyId) return;
    setMessage(null);
    const result = await saveStaffMobileDashboardPreferenceAction({ companyId: data.selectedCompanyId, ...draft });
    setMessageError(!result.success);
    setMessage(result.message ?? (result.success ? t("messages.saved") : t("messages.failed")));
    if (result.success && result.data) {
      setSaved(result.data);
      setDraft(result.data);
      router.refresh();
    }
  });
  const reset = () => startTransition(async () => {
    if (!data.selectedCompanyId) return;
    const result = await resetStaffMobileDashboardPreferenceAction({ companyId: data.selectedCompanyId });
    setResetOpen(false);
    setMessageError(!result.success);
    setMessage(result.message ?? (result.success ? t("messages.reset") : t("messages.failed")));
    if (result.success && result.data) {
      setSaved(result.data);
      setDraft(result.data);
      router.refresh();
    }
  });
  const preview = () => {
    if (!data.selectedCompanyId) return;
    if (dirty) {
      setMessageError(true);
      setMessage(t("messages.saveBeforePreview"));
      return;
    }
    if (!roleSwitch.enabled) {
      setMessageError(true);
      setMessage(t("messages.previewUnavailable"));
      return;
    }
    startTransition(async () => {
      const result = await startDeveloperRoleSessionAction({ previewRole: "STAFF", companyId: data.selectedCompanyId, propertyScopeMode: "ALL", propertyIds: [] });
      if (!result.success) {
        setMessageError(true);
        setMessage(result.message);
        return;
      }
      router.push("/");
      router.refresh();
    });
  };

  return <div className="space-y-4">
    <div className="space-y-1">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="size-4" />{t("title")}</h3>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
    </div>
    <label className="block space-y-2 text-sm font-medium">
      <span>{t("company")}</span>
      <select value={data.selectedCompanyId ?? ""} onChange={(event) => selectCompany(event.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm" disabled={pending || !data.companies.length}>
        <option value="" disabled>{t("selectCompany")}</option>
        {data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select>
    </label>

    {data.selectedCompanyId ? <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs">
        <Badge variant="outline">{data.selectedCompanyName}</Badge>
        <Badge variant="outline">STAFF</Badge>
        <Badge variant="outline">MOBILE</Badge>
        <span className="text-muted-foreground">{t("visibleCount", { count: visibleCount })}</span>
        {dirty && <Badge variant="secondary">{t("dirty")}</Badge>}
      </div>
      <DndContext id="staff-mobile-dashboard-card-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={draft.cardOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">{draft.cardOrder.map((id, index) => <SortableDashboardCard key={id} id={id} position={index + 1} hidden={draft.hiddenCardIds.includes(id)} onToggle={() => toggle(id)} />)}</div>
        </SortableContext>
      </DndContext>
      <div className="space-y-1 text-xs text-muted-foreground"><p>{t("mobileOnlyNotice")}</p><p>{t("previewNotice")}</p></div>
      {message && <p role="status" className={cn("text-sm", messageError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{message}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        <Button type="button" onClick={save} disabled={pending || !dirty}><Save />{pending ? t("processing") : t("save")}</Button>
        <Button type="button" variant="outline" onClick={() => setResetOpen(true)} disabled={pending}><RotateCcw />{t("reset")}</Button>
        <Button type="button" variant="outline" onClick={preview} disabled={pending}><ShieldCheck />{t("preview")}</Button>
      </div>
    </> : <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{data.companies.length ? t("selectCompanyPrompt") : t("noCompanies")}</div>}

    <Dialog open={resetOpen} onOpenChange={setResetOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("resetDialog.title")}</DialogTitle><DialogDescription>{t("resetDialog.description")}</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={pending}>{t("cancel")}</Button><Button type="button" variant="destructive" onClick={reset} disabled={pending}><RotateCcw />{t("reset")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
