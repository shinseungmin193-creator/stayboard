import { useTranslations } from "next-intl";
import { BedDouble } from "lucide-react";
import type { PropertyOption } from "@/features/properties";
import type { RoomListItem } from "../room.types";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoomActiveForm } from "./room-active-form";
import { RoomFormDialog } from "./room-form-dialog";

function ConnectionCounts({ room }: { room: RoomListItem }) {
  const i18n = useTranslations();
  return <div className="space-y-0.5 text-xs">
    <p>{i18n("roomListings.calendarCount", { count: room.calendarSourceCount })}</p>
    <p className="text-muted-foreground">{i18n("roomListings.listingCount", { count: room.listingCount })}</p>
  </div>;
}

export function RoomList({ rooms, properties, canManageCalendarSources }: {
  rooms: RoomListItem[];
  properties: PropertyOption[];
  canManageCalendarSources: boolean;
}) {
  const i18n = useTranslations();
  if (!rooms.length) return <Card><CardContent className="flex min-h-72 items-center"><EmptyState icon={BedDouble} title={i18n("auto.m0092")} description={i18n("auto.m0588")} /></CardContent></Card>;
  return <>
    <div className="grid gap-3 md:hidden">
      {rooms.map((room) => <Card key={room.id}><CardContent className="space-y-3 p-4">
        <div className="flex justify-between"><div><p className="font-semibold">{room.name}</p><p className="text-xs text-muted-foreground">{room.propertyName}{room.propertyIsActive ? "" : i18n("auto.m0589")}</p></div><Badge variant={room.isActive ? "secondary" : "outline"}>{room.isActive ? i18n("auto.m0210") : i18n("auto.m0115")}</Badge></div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground"><span>{i18n("auto.m0590")} {room.capacity}{i18n("auto.m0361")}</span><div className="col-span-2"><ConnectionCounts room={room} /></div></div>
        <div className="flex gap-2"><RoomFormDialog properties={properties} room={room} canManageCalendarSources={canManageCalendarSources} /><RoomActiveForm id={room.id} isActive={room.isActive} /></div>
      </CardContent></Card>)}
    </div>
    <Card className="hidden md:block"><Table><TableHeader><TableRow><TableHead>{i18n("common.room")}</TableHead><TableHead>{i18n("common.property")}</TableHead><TableHead>{i18n("auto.m0578")}</TableHead><TableHead>{i18n("auto.m0591")}</TableHead><TableHead>{i18n("common.status")}</TableHead><TableHead className="text-right">{i18n("navigation.groups.management")}</TableHead></TableRow></TableHeader><TableBody>{rooms.map((room) => <TableRow key={room.id}><TableCell><p className="font-medium">{room.name}</p></TableCell><TableCell>{room.propertyName}{!room.propertyIsActive && <Badge className="ml-2" variant="outline">{i18n("auto.m0592")}</Badge>}</TableCell><TableCell>{room.capacity}{i18n("auto.m0361")}</TableCell><TableCell><ConnectionCounts room={room} /></TableCell><TableCell><Badge variant={room.isActive ? "secondary" : "outline"}>{room.isActive ? i18n("auto.m0210") : i18n("auto.m0115")}</Badge></TableCell><TableCell><div className="flex justify-end gap-2"><RoomFormDialog properties={properties} room={room} canManageCalendarSources={canManageCalendarSources} /><RoomActiveForm id={room.id} isActive={room.isActive} /></div></TableCell></TableRow>)}</TableBody></Table></Card>
  </>;
}
