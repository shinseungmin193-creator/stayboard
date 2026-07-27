"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReservationFilterState } from "../reservation-filter-query";
import { getReservationStatusLabel } from "../reservation-status-meta";
import type { ReservationPropertyOption, ReservationProviderOption, ReservationRoomOption } from "./reservation-filter-fields";

interface FilterChip { key: string; label: string; remove: () => void }

function dotDate(value: string) { return value.replaceAll("-", "."); }

export function ActiveReservationFilters({ filters, properties, rooms, providers, onChange, className }: {
  filters: ReservationFilterState;
  properties: ReservationPropertyOption[];
  rooms: ReservationRoomOption[];
  providers: ReservationProviderOption[];
  onChange: (filters: ReservationFilterState) => void;
  className?: string;
}) {
  const chips: FilterChip[] = [];
  if (filters.search) chips.push({ key: "search", label: `검색: ${filters.search}`, remove: () => onChange({ ...filters, search: "" }) });
  if (filters.propertyId) chips.push({ key: "property", label: `숙소: ${properties.find((item) => item.id === filters.propertyId)?.name ?? "선택됨"}`, remove: () => onChange({ ...filters, propertyId: null, roomId: null }) });
  if (filters.roomId) chips.push({ key: "room", label: `객실: ${rooms.find((item) => item.id === filters.roomId)?.name ?? "선택됨"}`, remove: () => onChange({ ...filters, roomId: null }) });
  for (const provider of filters.providers) chips.push({ key: `provider-${provider}`, label: `OTA: ${providers.find((item) => item.value === provider)?.label ?? provider}`, remove: () => onChange({ ...filters, providers: filters.providers.filter((item) => item !== provider) }) });
  for (const status of filters.statuses) chips.push({ key: `status-${status}`, label: `상태: ${getReservationStatusLabel(status)}`, remove: () => onChange({ ...filters, statuses: filters.statuses.filter((item) => item !== status) }) });
  if (filters.from || filters.to) chips.push({ key: "date", label: `기간: ${filters.from ? dotDate(filters.from) : "-"} ~ ${filters.to ? dotDate(filters.to) : "-"}`, remove: () => onChange({ ...filters, from: null, to: null, dateField: "stay" }) });
  if (filters.hasConflict !== null) chips.push({ key: "conflict", label: filters.hasConflict ? "오버부킹만" : "겹침 제외", remove: () => onChange({ ...filters, hasConflict: null }) });
  if (!chips.length) return null;
  return (
    <div className={cn("-mx-3 overflow-x-auto px-3", className)} aria-label="적용된 필터">
      <div className="flex w-max min-w-full gap-2 pb-1">
        {chips.map((chip) => <button key={chip.key} type="button" onClick={chip.remove} className="flex min-h-9 max-w-64 items-center gap-1.5 rounded-full border bg-muted/60 px-3 text-xs font-medium hover:bg-muted"><span className="truncate">{chip.label}</span><X className="size-3.5 shrink-0" aria-hidden="true" /><span className="sr-only">필터 제거</span></button>)}
      </div>
    </div>
  );
}
