"use client";import { useTranslations } from "next-intl";

import { useState } from "react";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import { Button } from "@/components/ui/button";
import { getRoomCalendarStatusLabel, ROOM_CALENDAR_STATUS_META, type RoomCalendarFilters, type RoomCalendarStatus } from "../types/room-calendar-summary";

const providers: CalendarProviderType[] = ["AIRBNB", "BOOKING", "AGODA"];
const statuses = Object.keys(ROOM_CALENDAR_STATUS_META) as RoomCalendarStatus[];

export function RoomCalendarFilterBar({ filters, rooms }: {filters: RoomCalendarFilters;rooms: CalendarRoomOption[];}) {const i18n = useTranslations();
  const [propertyId, setPropertyId] = useState(filters.propertyId ?? "");
  const [roomId, setRoomId] = useState(filters.roomId ?? "");
  const [provider, setProvider] = useState(filters.provider ?? "");
  const [status, setStatus] = useState(filters.status ?? "");

  const properties = [...new Map(rooms.map((room) => [room.propertyId, room.propertyName])).entries()];
  const filteredRooms = propertyId ? rooms.filter((room) => room.propertyId === propertyId) : rooms;
  const selectClassName = "h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm";

  return (
    <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(8rem,.8fr)_minmax(8rem,.8fr)_auto]">
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        <span>{i18n("common.property")}</span>
        <select name="propertyId" value={propertyId} onChange={(event) => {setPropertyId(event.target.value);setRoomId("");}} className={selectClassName}>
          <option value="">{i18n("auto.m0079")}</option>
          {properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        <span>{i18n("common.room")}</span>
        <select name="roomId" value={roomId} onChange={(event) => setRoomId(event.target.value)} className={selectClassName}>
          <option value="">{i18n("auto.m0081")}</option>
          {filteredRooms.map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        <span>{i18n("technical.provider")}</span>
        <select name="provider" value={provider} onChange={(event) => setProvider(event.target.value as CalendarProviderType | "")} className={selectClassName}>
          <option value="">{i18n("auto.m0083")}</option>
          {providers.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        <span>{i18n("auto.m0243")}</span>
        <select name="status" value={status} onChange={(event) => setStatus(event.target.value as RoomCalendarStatus | "")} className={selectClassName}>
          <option value="">{i18n("auto.m0244")}</option>
          {statuses.map((item) => <option key={item} value={item}>{getRoomCalendarStatusLabel(item, i18n)}</option>)}
        </select>
      </label>
      <Button type="submit" variant="outline" className="self-end">{i18n("auto.m0087")}</Button>
    </form>);

}
