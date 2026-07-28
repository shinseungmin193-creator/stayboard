"use client";import { useTranslations } from "next-intl";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MobileRoomFilters } from "../domain/room-overview-mobile";











const fieldClassName = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function RoomStatusFilterSheet({
  filters,
  propertyId,
  properties,
  onApply,
  onReset






}: {filters: MobileRoomFilters;propertyId?: string;properties: Array<{id: string;name: string;isActive: boolean;}>;onApply: (filters: MobileRoomFilters, propertyId?: string) => void;onReset: () => void;}) {const i18n = useTranslations();const statusOptions: Array<{value: MobileRoomFilters["status"];label: string;}> = [{ value: "ALL", label: i18n("auto.m0244") }, { value: "RESERVED", label: i18n("common.reservation") }, { value: "VACANT", label: i18n("reservation.vacant") }, { value: "CHECK_IN_TODAY", label: i18n("reservation.checkIn") }, { value: "CHECK_OUT_TODAY", label: i18n("reservation.checkOut") }, { value: "CLEANING", label: i18n("roomStatus.cleaning") }, { value: "CONFLICT", label: i18n("reservation.overbooking") }];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(filters);
  const [draftPropertyId, setDraftPropertyId] = useState(propertyId ?? "");
  const activeCount = Number(filters.status !== "ALL") + Number(filters.ota !== "ALL") + Number(filters.sync !== "ALL") + Number(Boolean(propertyId));

  const changeOpen = (next: boolean) => {
    if (next) {
      setDraft(filters);
      setDraftPropertyId(propertyId ?? "");
    }
    setOpen(next);
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetTrigger render={<Button type="button" variant="outline" size="icon" className="relative min-h-10 min-w-10" aria-label={i18n("auto.m0510")} />}>
        <SlidersHorizontal />
        {activeCount > 0 && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">{activeCount}</span>}
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0" aria-label={i18n("auto.m0080")}>
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle>{i18n("auto.m0080")}</SheetTitle>
          <SheetDescription>{i18n("auto.m0511")}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 overflow-y-auto px-4 py-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mobile-room-query">{i18n("auto.m0492")}</Label>
            <input id="mobile-room-query" value={draft.query} onChange={(event) => setDraft((current) => ({ ...current, query: event.target.value }))} placeholder={i18n("auto.m0512")} className={fieldClassName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-property">{i18n("common.property")}</Label>
            <select id="mobile-room-property" value={draftPropertyId} onChange={(event) => setDraftPropertyId(event.target.value)} className={fieldClassName}>
              <option value="">{i18n("auto.m0079")}</option>
              {properties.filter((property) => property.isActive).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-status">{i18n("common.status")}</Label>
            <select id="mobile-room-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as MobileRoomFilters["status"] }))} className={fieldClassName}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-ota">{i18n("auto.m0470")}</Label>
            <select id="mobile-room-ota" value={draft.ota} onChange={(event) => setDraft((current) => ({ ...current, ota: event.target.value as MobileRoomFilters["ota"] }))} className={fieldClassName}>
              <option value="ALL">{i18n("auto.m0081")}</option>
              <option value="CONNECTED">{i18n("auto.m0513")}</option>
              <option value="DISCONNECTED">{i18n("auto.m0248")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile-room-sync">{i18n("auto.m0514")}</Label>
            <select id="mobile-room-sync" value={draft.sync} onChange={(event) => setDraft((current) => ({ ...current, sync: event.target.value as MobileRoomFilters["sync"] }))} className={fieldClassName}>
              <option value="ALL">{i18n("auto.m0244")}</option>
              <option value="ERROR">{i18n("auto.m0515")}</option>
              <option value="NORMAL">{i18n("auto.m0516")}</option>
            </select>
          </div>
        </div>
        <SheetFooter className="grid grid-cols-2 border-t p-4">
          <Button type="button" variant="outline" onClick={() => {onReset();setOpen(false);}}>{i18n("auto.m0403")}</Button>
          <SheetClose render={<Button type="button" onClick={() => onApply(draft, draftPropertyId || undefined)} />}>{i18n("auto.m0096")}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>);

}
