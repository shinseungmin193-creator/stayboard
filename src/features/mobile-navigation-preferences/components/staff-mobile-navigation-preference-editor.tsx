"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, LockKeyhole, MoreHorizontal, RotateCcw, Save, ShieldCheck, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { startDeveloperRoleSessionAction } from "@/features/developer-role-switch/developer-role-switch.actions";
import { useDeveloperRoleSwitch } from "@/features/developer-role-switch/components/developer-role-switch-provider";
import { findSidebarMenu, type SidebarMenuId } from "@/features/sidebar-preferences/domain/sidebar-menu";
import {
  resetStaffMobileNavigationPreferenceAction,
  saveStaffMobileNavigationPreferenceAction,
} from "../mobile-navigation-preference.actions";
import {
  STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS,
  type MobileNavigationPreferenceValue,
} from "../domain/mobile-navigation-preference";

export interface StaffMobileNavigationPreferenceEditorData {
  companies: readonly { id: string; name: string }[];
  selectedCompanyId: string | null;
  selectedCompanyName: string | null;
  preference: MobileNavigationPreferenceValue;
}

function samePreference(left: MobileNavigationPreferenceValue, right: MobileNavigationPreferenceValue) {
  return left.itemOrder.join("|") === right.itemOrder.join("|");
}

function SortableNavigationItem({
  id,
  position,
  selectedIds,
  onChange,
}: {
  id: SidebarMenuId;
  position: number;
  selectedIds: readonly SidebarMenuId[];
  onChange(id: SidebarMenuId): void;
}) {
  const t = useTranslations();
  const preferenceT = useTranslations("mobileNavigationPreferences");
  const item = findSidebarMenu(id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  if (!item) return null;
  const label = t(`navigation.items.${item.id}` as Parameters<typeof t>[0]);
  const availableIds = STAFF_MOBILE_BOTTOM_NAVIGATION_MENU_IDS.filter((candidateId) => (
    candidateId === id || !selectedIds.includes(candidateId)
  ));

  return <div ref={setNodeRef} style={style} className={cn("flex min-h-14 items-center gap-2 rounded-lg border bg-background px-2.5 py-2 transition-shadow", isDragging && "z-10 shadow-md ring-2 ring-primary/30")}>
    <span className="w-7 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground" aria-label={preferenceT("position", { position })}>{String(position).padStart(2, "0")}</span>
    <button type="button" className="grid size-8 shrink-0 touch-none cursor-grab place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-ring" aria-label={preferenceT("dragHandle", { label })} {...attributes} {...listeners}>
      <GripVertical className="size-4" />
    </button>
    <item.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <select value={id} aria-label={preferenceT("menuForPosition", { position })} onChange={(event) => onChange(event.target.value as SidebarMenuId)} className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm font-medium">
      {availableIds.map((candidateId) => {
        const candidate = findSidebarMenu(candidateId);
        return candidate ? <option key={candidate.id} value={candidate.id}>{t(`navigation.items.${candidate.id}` as Parameters<typeof t>[0])}</option> : null;
      })}
    </select>
  </div>;
}

export function StaffMobileNavigationPreferenceEditor({ data }: { data: StaffMobileNavigationPreferenceEditorData }) {
  const t = useTranslations("mobileNavigationPreferences");
  const navigationT = useTranslations("navigation");
  const router = useRouter();
  const roleSwitch = useDeveloperRoleSwitch();
  const [saved, setSaved] = useState<MobileNavigationPreferenceValue>(data.preference);
  const [draft, setDraft] = useState<MobileNavigationPreferenceValue>(data.preference);
  const [message, setMessage] = useState<string | null>(null);
  const [messageError, setMessageError] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = !samePreference(saved, draft);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selectCompany = (companyId: string) => {
    if (companyId === data.selectedCompanyId) return;
    if (dirty && !window.confirm(t("unsavedCompanyChange"))) return;
    router.push(`/developer/settings?staffMobileNavigationCompanyId=${encodeURIComponent(companyId)}`);
  };
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setMessage(null);
    setDraft((current) => ({
      itemOrder: arrayMove(current.itemOrder, current.itemOrder.indexOf(active.id as SidebarMenuId), current.itemOrder.indexOf(over.id as SidebarMenuId)),
    }));
  };
  const replaceItem = (position: number, id: SidebarMenuId) => {
    setMessage(null);
    setDraft((current) => ({ itemOrder: current.itemOrder.map((currentId, index) => index === position ? id : currentId) }));
  };
  const save = () => startTransition(async () => {
    if (!data.selectedCompanyId) return;
    setMessage(null);
    const result = await saveStaffMobileNavigationPreferenceAction({ companyId: data.selectedCompanyId, itemOrder: draft.itemOrder });
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
    const result = await resetStaffMobileNavigationPreferenceAction({ companyId: data.selectedCompanyId });
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
    <div className="space-y-1"><h3 className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="size-4" />{t("title")}</h3><p className="text-sm text-muted-foreground">{t("description")}</p></div>
    <label className="block space-y-2 text-sm font-medium"><span>{t("company")}</span><select value={data.selectedCompanyId ?? ""} onChange={(event) => selectCompany(event.target.value)} className="h-9 w-full rounded-lg border bg-background px-3 text-sm" disabled={pending || !data.companies.length}><option value="" disabled>{t("selectCompany")}</option>{data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>

    {data.selectedCompanyId ? <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs"><Badge variant="outline">{data.selectedCompanyName}</Badge><Badge variant="outline">STAFF</Badge><Badge variant="outline">MOBILE</Badge><span className="text-muted-foreground">{t("menuCount", { count: draft.itemOrder.length })}</span>{dirty && <Badge variant="secondary">{t("dirty")}</Badge>}</div>
      <DndContext id="staff-mobile-bottom-navigation-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}><SortableContext items={draft.itemOrder} strategy={verticalListSortingStrategy}><div className="space-y-2">{draft.itemOrder.map((id, index) => <SortableNavigationItem key={id} id={id} position={index + 1} selectedIds={draft.itemOrder} onChange={(nextId) => replaceItem(index, nextId)} />)}</div></SortableContext></DndContext>
      <div className="flex min-h-14 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-2"><span className="w-7 shrink-0 text-center font-mono text-xs text-muted-foreground">05</span><span className="grid size-8 shrink-0 place-items-center text-muted-foreground"><LockKeyhole className="size-4" /></span><MoreHorizontal className="size-4 text-muted-foreground" /><span className="flex-1 text-sm font-medium">{navigationT("more")}</span><Badge variant="outline">{t("fixed")}</Badge></div>
      <div className="space-y-1 text-xs text-muted-foreground"><p>{t("staffOnlyNotice")}</p><p>{t("previewNotice")}</p></div>
      {message && <p role="status" className={cn("text-sm", messageError ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{message}</p>}
      <div className="grid gap-2 sm:grid-cols-3"><Button type="button" onClick={save} disabled={pending || !dirty}><Save />{pending ? t("processing") : t("save")}</Button><Button type="button" variant="outline" onClick={() => setResetOpen(true)} disabled={pending}><RotateCcw />{t("reset")}</Button><Button type="button" variant="outline" onClick={preview} disabled={pending}><ShieldCheck />{t("preview")}</Button></div>
    </> : <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{data.companies.length ? t("selectCompanyPrompt") : t("noCompanies")}</div>}

    <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogContent><DialogHeader><DialogTitle>{t("resetDialog.title")}</DialogTitle><DialogDescription>{t("resetDialog.description")}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={pending}>{t("cancel")}</Button><Button type="button" variant="destructive" onClick={reset} disabled={pending}><RotateCcw />{t("reset")}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
