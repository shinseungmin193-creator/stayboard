"use client";import { useTranslations } from "next-intl";

import Link from "next/link";
import { CalendarDays, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RoomOverviewCard } from "../domain/room-overview";
import { RoomStatusRoomSyncButton } from "./room-status-room-sync-button";

export function RoomSelectionActionBar({ rooms, canSync, onShowDetail, onClose }: {rooms: RoomOverviewCard[];canSync: boolean;onShowDetail: () => void;onClose: () => void;}) {const i18n = useTranslations();
  if (!rooms.length) return null;
  const first = rooms[0];
  return <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 rounded-xl border bg-card/95 p-2 shadow-lg backdrop-blur xl:hidden" role="region" aria-label={i18n("auto.m0503")}>
    <div className="mb-1.5 flex items-center justify-between px-1"><strong className="text-xs">{rooms.length}{i18n("auto.m0504")}</strong><Button type="button" variant="ghost" size="icon-xs" onClick={onClose} aria-label={i18n("auto.m0505")}><X /></Button></div>
    <div className="grid grid-cols-3 gap-1.5">
      <Button type="button" variant="outline" size="sm" onClick={onShowDetail}><Info />{i18n("common.details")}</Button>
      <Button nativeButton={false} render={<Link href={`/room-status?propertyId=${first.propertyId}`} />} variant="outline" size="sm"><CalendarDays />{i18n("common.calendar")}</Button>
      {canSync ? <RoomStatusRoomSyncButton roomIds={rooms.map((room) => room.id)} label={i18n("common.sync")} className="min-w-0 px-2" /> : <Button type="button" variant="outline" size="sm" disabled>{i18n("common.sync")}</Button>}
    </div>
  </div>;
}
