import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { serializeRoomNoteStatusFilter } from "../domain/room-note";
import type { RoomNoteFilters, RoomNoteOptions } from "../room-note.types";

export async function RoomNoteFilterBar({ filters, options }: { filters: RoomNoteFilters; options: RoomNoteOptions }) {
  const t = await getTranslations("roomNotes");
  return <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,0.65fr)_minmax(11rem,0.8fr)_minmax(9rem,0.6fr)_minmax(14rem,1.35fr)_auto_auto] lg:items-end">
    <label className="space-y-1 text-xs font-medium"><span>{t("filters.property")}</span><select name="propertyId" defaultValue={filters.propertyId ?? ""} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm md:h-8"><option value="">{t("filters.allProperties")}</option>{options.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label>
    <label className="space-y-1 text-xs font-medium"><span>{t("filters.room")}</span><select name="roomId" defaultValue={filters.roomId ?? ""} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm md:h-8"><option value="">{t("filters.allRooms")}</option>{options.rooms.filter((room) => !filters.propertyId || room.propertyId === filters.propertyId).map((room) => <option key={room.id} value={room.id}>{room.propertyName} · {room.name}</option>)}</select></label>
    <label className="space-y-1 text-xs font-medium"><span>{t("filters.status")}</span><select name="status" defaultValue={serializeRoomNoteStatusFilter(filters.status)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm md:h-8"><option value="open">{t("status.OPEN")}</option><option value="completed">{t("status.COMPLETED")}</option><option value="all">{t("filters.allStatuses")}</option></select></label>
    <label className="space-y-1 text-xs font-medium sm:col-span-2 lg:col-span-1"><span>{t("filters.search")}</span><Input name="query" defaultValue={filters.query} maxLength={100} placeholder={t("filters.placeholder")} /></label>
    <Button type="submit" className="w-full lg:w-auto"><Search />{t("actions.apply")}</Button>
    <Button nativeButton={false} render={<Link href="/room-notes" />} variant="outline" className="w-full lg:w-auto">{t("actions.reset")}</Button>
  </form>;
}
