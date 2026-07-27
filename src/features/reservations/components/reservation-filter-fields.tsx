"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import type { ReservationFilterState } from "../reservation-filter-query";
import { ACTIVE_RESERVATION_DISPLAY_STATUSES } from "../reservation-display-status";
import { getReservationDatePresetRange, type ReservationDatePreset } from "../reservation-date-presets";
import { getReservationStatusLabel, getReservationStatusVariant } from "../reservation-status-meta";

export interface ReservationPropertyOption { id: string; name: string; isActive?: boolean }
export interface ReservationRoomOption { id: string; name: string; propertyId: string; propertyName: string }
export interface ReservationProviderOption { value: CalendarProviderType; label: string }

const STATUS_OPTIONS = ACTIVE_RESERVATION_DISPLAY_STATUSES;
const DATE_PRESETS: Array<{ value: Exclude<ReservationDatePreset, "custom">; label: string }> = [
  { value: "today", label: "오늘" },
  { value: "this-week", label: "이번 주" },
  { value: "this-month", label: "이번 달" },
];
const MAX_VISIBLE_ROOMS = 40;
const fieldClassName = "h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ReservationFilterFields({
  value,
  onChange,
  properties,
  rooms,
  providers,
  effectiveDateRange,
  compact = false,
}: {
  value: ReservationFilterState;
  onChange: (next: ReservationFilterState) => void;
  properties: ReservationPropertyOption[];
  rooms: ReservationRoomOption[];
  providers: ReservationProviderOption[];
  effectiveDateRange: { from: string; to: string };
  compact?: boolean;
}) {
  const [roomQuery, setRoomQuery] = useState("");
  const eligibleRooms = useMemo(() => {
    const normalized = roomQuery.trim().toLocaleLowerCase("ko");
    return rooms
      .filter((room) => !value.propertyId || room.propertyId === value.propertyId)
      .filter((room) => !normalized || `${room.name} ${room.propertyName}`.toLocaleLowerCase("ko").includes(normalized))
      .slice(0, MAX_VISIBLE_ROOMS);
  }, [roomQuery, rooms, value.propertyId]);
  const currentRoom = rooms.find((room) => room.id === value.roomId);
  const compactRooms = currentRoom && !eligibleRooms.some((room) => room.id === currentRoom.id)
    ? [currentRoom, ...eligibleRooms.slice(0, MAX_VISIBLE_ROOMS - 1)]
    : eligibleRooms;

  const applyPreset = (preset: Exclude<ReservationDatePreset, "custom">) => {
    const range = getReservationDatePresetRange(preset);
    onChange({ ...value, from: range.from, to: range.to });
  };

  return (
    <div className={cn("grid gap-5", compact && "lg:grid-cols-4 lg:gap-3")}>
      <div className="space-y-1.5">
        <Label htmlFor={compact ? "desktop-reservation-property" : "mobile-reservation-property"}>숙소</Label>
        <select
          id={compact ? "desktop-reservation-property" : "mobile-reservation-property"}
          value={value.propertyId ?? ""}
          onChange={(event) => {
            const propertyId = event.target.value || null;
            const roomStillEligible = !value.roomId || rooms.some((room) => room.id === value.roomId && (!propertyId || room.propertyId === propertyId));
            onChange({ ...value, propertyId, roomId: roomStillEligible ? value.roomId : null });
          }}
          className={fieldClassName}
        >
          <option value="">모든 숙소</option>
          {properties.filter((property) => property.isActive !== false).map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
      </div>

      <div className={cn("space-y-1.5", !compact && "min-w-0")}>
        <Label htmlFor={compact ? "desktop-reservation-room" : "mobile-reservation-room"}>객실</Label>
        {compact ? (
          <select id="desktop-reservation-room" value={value.roomId ?? ""} onChange={(event) => onChange({ ...value, roomId: event.target.value || null })} className={fieldClassName}>
            <option value="">모든 객실</option>
            {compactRooms.map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}
          </select>
        ) : (
          <div className="space-y-2">
            <div className="relative"><Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" /><input id="mobile-reservation-room" value={roomQuery} onChange={(event) => setRoomQuery(event.target.value)} placeholder={currentRoom ? `${currentRoom.propertyName} · ${currentRoom.name}` : "객실 번호 또는 이름 검색"} className={cn(fieldClassName, "pl-9")} /></div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-1" role="listbox" aria-label="객실 선택">
              <button type="button" onClick={() => onChange({ ...value, roomId: null })} className={cn("flex min-h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm hover:bg-muted", !value.roomId && "bg-muted font-semibold")}><span>모든 객실</span>{!value.roomId && <Check className="size-4" />}</button>
              {eligibleRooms.map((room) => <button key={room.id} type="button" role="option" aria-selected={value.roomId === room.id} onClick={() => onChange({ ...value, propertyId: room.propertyId, roomId: room.id })} className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-sm hover:bg-muted", value.roomId === room.id && "bg-muted font-semibold")}><span className="min-w-0 truncate">{room.name} <span className="text-xs font-normal text-muted-foreground">· {room.propertyName}</span></span>{value.roomId === room.id && <Check className="size-4 shrink-0" />}</button>)}
              {eligibleRooms.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted-foreground">검색 결과가 없습니다.</p>}
            </div>
          </div>
        )}
      </div>

      <fieldset className={cn("space-y-2", compact && "lg:col-span-2")}>
        <legend className="text-sm font-medium">OTA</legend>
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => { const selected = value.providers.includes(provider.value); return <button key={provider.value} type="button" aria-pressed={selected} onClick={() => onChange({ ...value, providers: toggleValue(value.providers, provider.value) })} className={cn("min-h-10 rounded-full border px-3 text-xs font-semibold transition", selected ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>{provider.label}</button>; })}
        </div>
      </fieldset>

      <fieldset className={cn("space-y-2", compact && "lg:col-span-2")}>
        <legend className="text-sm font-medium">예약 상태</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={value.statuses.length === 0} onClick={() => onChange({ ...value, statuses: [] })} className={cn("min-h-10 rounded-full border px-3 text-xs font-semibold transition", value.statuses.length === 0 ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>전체</button>
          {STATUS_OPTIONS.map((status) => { const selected = value.statuses.includes(status); return <button key={status} type="button" aria-pressed={selected} onClick={() => onChange({ ...value, statuses: toggleValue(value.statuses, status) })} className={cn("min-h-10 rounded-full border px-3 text-xs font-semibold transition", selected ? getReservationStatusVariant(status) : "bg-background hover:bg-muted")}>{getReservationStatusLabel(status)}</button>; })}
        </div>
      </fieldset>

      <div className={cn("space-y-2", compact && "lg:col-span-2")}>
        <Label htmlFor={compact ? "desktop-reservation-date-field" : "mobile-reservation-date-field"}>날짜 기준</Label>
        <select id={compact ? "desktop-reservation-date-field" : "mobile-reservation-date-field"} value={value.dateField} onChange={(event) => onChange({ ...value, dateField: event.target.value as ReservationFilterState["dateField"] })} className={fieldClassName}>
          <option value="stay">숙박 기간</option><option value="checkIn">체크인 날짜</option><option value="checkOut">체크아웃 날짜</option>
        </select>
      </div>

      <div className={cn("space-y-2", compact && "lg:col-span-2")}>
        <span className="text-sm font-medium">빠른 기간</span>
        <div className="grid grid-cols-3 gap-2">{DATE_PRESETS.map((preset) => <Button key={preset.value} type="button" variant="outline" size="sm" onClick={() => applyPreset(preset.value)} className="min-h-10">{preset.label}</Button>)}</div>
      </div>

      <div className={cn("grid grid-cols-2 gap-2", compact && "lg:col-span-2")}>
        <div className="space-y-1.5"><Label htmlFor={compact ? "desktop-reservation-from" : "mobile-reservation-from"}>시작일</Label><input id={compact ? "desktop-reservation-from" : "mobile-reservation-from"} type="date" value={value.from ?? effectiveDateRange.from} max={value.to ?? effectiveDateRange.to} onChange={(event) => onChange({ ...value, from: event.target.value || null })} className={fieldClassName} /></div>
        <div className="space-y-1.5"><Label htmlFor={compact ? "desktop-reservation-to" : "mobile-reservation-to"}>종료일</Label><input id={compact ? "desktop-reservation-to" : "mobile-reservation-to"} type="date" value={value.to ?? effectiveDateRange.to} min={value.from ?? effectiveDateRange.from} onChange={(event) => onChange({ ...value, to: event.target.value || null })} className={fieldClassName} /></div>
      </div>

      <div className={cn("space-y-2", compact && "lg:col-span-2")}>
        <span className="text-sm font-medium">겹치는 예약</span>
        <button type="button" aria-pressed={value.hasConflict === true} onClick={() => onChange({ ...value, hasConflict: value.hasConflict === true ? null : true })} className={cn("flex min-h-11 w-full items-center justify-between rounded-lg border px-3 text-sm", value.hasConflict === true ? "border-destructive/60 bg-destructive/10 font-semibold text-destructive" : "bg-background hover:bg-muted")}><span>오버부킹만 보기</span>{value.hasConflict === true && <Check className="size-4" />}</button>
      </div>
    </div>
  );
}
