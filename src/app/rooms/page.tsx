import { getTranslations } from "next-intl/server";import Link from "next/link";
import { listPropertyOptions } from "@/features/properties";
import { listRooms } from "@/features/rooms";
import { RoomCreateDialog as RoomFormDialog } from "@/features/rooms/components/room-create-dialog";
import { RoomList } from "@/features/rooms/components/room-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, companyScopeIds, hasPermission, PERMISSIONS } from "@/features/access-control";

export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("auto.m0100") }; }
export const dynamic = "force-dynamic";

export default async function RoomsPage({ searchParams }: {searchParams: Promise<{propertyId?: string | string[];}>;}) {const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.ROOM_MANAGE);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const params = await searchParams;
  const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
  const companyIds = companyScopeIds(access.context);
  const [properties, rooms] = await Promise.all([listPropertyOptions(companyIds), listRooms(propertyId, companyIds)]);
  return <div className="space-y-5"><PageHeader eyebrow="INVENTORY" title={i18n("auto.m0100")} description={i18n("auto.m0101")} action={<RoomFormDialog properties={properties} />} /><div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label={i18n("auto.m0078")}><Button nativeButton={false} render={<Link href="/rooms" />} variant={!propertyId ? "default" : "outline"} size="sm">{i18n("auto.m0102")}</Button>{properties.map((property) => <Button key={property.id} nativeButton={false} render={<Link href={`/rooms?propertyId=${encodeURIComponent(property.id)}`} />} variant={propertyId === property.id ? "default" : "outline"} size="sm">{property.name}{property.isActive ? "" : i18n("auto.m0103")}</Button>)}</div><RoomList rooms={rooms} properties={properties} canManageCalendarSources={hasPermission(access.context.role, PERMISSIONS.CALENDAR_SOURCE_MANAGE)} /></div>;
}
