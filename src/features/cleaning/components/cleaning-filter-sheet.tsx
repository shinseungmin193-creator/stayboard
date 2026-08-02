"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { CleaningFilters, CleaningPageData } from "../cleaning.types";

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
        {children}
      </select>
    </label>
  );
}

export function getCleaningActiveFilterCount(filters: CleaningFilters) {
  return [
    filters.companyId,
    filters.propertyId,
    filters.roomId,
    filters.unassignedOnly ? null : filters.assigneeId,
    filters.status,
    filters.priority,
    filters.unassignedOnly,
  ].filter(Boolean).length;
}

export function CleaningFilterSheet({ filters, data, onApply }: { filters: CleaningFilters; data: CleaningPageData; onApply: (filters: Partial<CleaningFilters>) => void }) {
  const t = useTranslations("cleaning.filters");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const count = getCleaningActiveFilterCount(filters);
  const properties = useMemo(() => data.properties.filter((property) => !draft.companyId || property.companyId === draft.companyId), [data.properties, draft.companyId]);
  const rooms = useMemo(() => data.rooms.filter((room) => !draft.propertyId || room.propertyId === draft.propertyId), [data.rooms, draft.propertyId]);
  const reset = () => setDraft({ ...draft, companyId: null, propertyId: null, roomId: null, assigneeId: null, status: null, priority: null, unassignedOnly: false });

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => { if (nextOpen) setDraft(filters); setOpen(nextOpen); }}>
      <SheetTrigger render={<Button type="button" variant="outline" className="relative gap-2" />}>
        <Filter />{t("button")}
        {count > 0 && <Badge className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[10px]">{count}</Badge>}
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto w-full max-w-2xl rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 pb-2 sm:grid-cols-2">
          {data.companies.length > 1 && <SelectField label={t("company")} value={draft.companyId ?? ""} onChange={(companyId) => setDraft({ ...draft, companyId: companyId || null, propertyId: null, roomId: null })}>
            <option value="">{t("allCompanies")}</option>{data.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
          </SelectField>}
          <SelectField label={common("property")} value={draft.propertyId ?? ""} onChange={(propertyId) => setDraft({ ...draft, propertyId: propertyId || null, roomId: null })}>
            <option value="">{t("allProperties")}</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </SelectField>
          <SelectField label={common("room")} value={draft.roomId ?? ""} onChange={(roomId) => setDraft({ ...draft, roomId: roomId || null })}>
            <option value="">{t("allRooms")}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </SelectField>
          <SelectField label={t("assignee")} value={draft.assigneeId ?? ""} onChange={(assigneeId) => setDraft({ ...draft, assigneeId: assigneeId || null, unassignedOnly: assigneeId === "unassigned" })}>
            <option value="">{t("allAssignees")}</option><option value="unassigned">{t("unassigned")}</option>{data.assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}
          </SelectField>
          <SelectField label={common("status")} value={draft.status ?? ""} onChange={(status) => setDraft({ ...draft, status: status ? status as CleaningFilters["status"] : null })}>
            <option value="">{t("allStatuses")}</option><option value="UNASSIGNED">{t("statusUnassigned")}</option><option value="WAITING">{t("statusWaiting")}</option><option value="IN_PROGRESS">{t("statusInProgress")}</option><option value="COMPLETED">{t("statusCompleted")}</option>
          </SelectField>
          <SelectField label={t("priority")} value={draft.priority ?? ""} onChange={(priority) => setDraft({ ...draft, priority: priority ? priority as CleaningFilters["priority"] : null })}>
            <option value="">{t("allPriorities")}</option><option value="urgent">{t("urgent")}</option><option value="flexible">{t("flexible")}</option>
          </SelectField>
          <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 text-sm font-medium sm:col-span-2">
            <span>{t("unassignedOnly")}</span>
            <input type="checkbox" checked={draft.unassignedOnly} onChange={(event) => setDraft({ ...draft, unassignedOnly: event.target.checked, assigneeId: event.target.checked ? "unassigned" : draft.assigneeId === "unassigned" ? null : draft.assigneeId })} className="size-4 accent-primary" />
          </label>
        </div>
        <SheetFooter className="grid grid-cols-2 border-t sm:flex sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={reset}>{t("reset")}</Button>
          <Button type="button" onClick={() => { onApply({ ...draft, section: "all", page: 1 }); setOpen(false); }}>{t("apply")}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
