import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { listCompanies, listCompanyOptions } from "@/features/companies";
import { CompanyList } from "@/features/companies/components/company-list";
import { listProperties } from "@/features/properties";
import { PropertyFormDialog } from "@/features/properties/components/property-form-dialog";
import { PropertyList } from "@/features/properties/components/property-list";
import { listRooms } from "@/features/rooms";
import { RoomCreateDialog } from "@/features/rooms/components/room-create-dialog";
import { RoomList } from "@/features/rooms/components/room-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AccessDenied,
  authorizeSidebarMenuAccess,
  companyScopeIds,
  hasPermission,
  PERMISSIONS,
} from "@/features/access-control";

export async function generateMetadata() {
  const i18n = await getTranslations();
  return { title: i18n("navigation.items.properties") };
}

export const dynamic = "force-dynamic";

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string | string[] }>;
}) {
  const i18n = await getTranslations();
  const access = await authorizeSidebarMenuAccess("properties");
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;

  const params = await searchParams;
  const requestedPropertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
  const companyIds = companyScopeIds(access.context);
  const [companies, companyOptions, properties] = await Promise.all([
    listCompanies(companyIds),
    listCompanyOptions(companyIds),
    listProperties(companyIds),
  ]);
  const selectedProperty = requestedPropertyId
    ? properties.find((property) => property.id === requestedPropertyId)
    : undefined;
  const selectedPropertyId = selectedProperty?.id;
  const rooms = selectedPropertyId ? await listRooms(selectedPropertyId, companyIds) : [];
  const propertyOptions = properties.map(({ id, companyId, name, isActive }) => ({
    id,
    companyId,
    name,
    isActive,
  }));
  const hasActiveCompany = companyOptions.some((company) => company.isActive);
  const canManageCompanies = hasPermission(access.context.role, PERMISSIONS.COMPANY_MANAGE);
  const canManageCalendarSources = hasPermission(access.context.role, PERMISSIONS.CALENDAR_SOURCE_MANAGE);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="INVENTORY"
        title={i18n("navigation.items.properties")}
        description={i18n("propertyRooms.description")}
        action={(
          <div className="flex flex-wrap gap-2">
            <PropertyFormDialog companies={companyOptions} />
            <RoomCreateDialog
              key={selectedPropertyId ?? "no-property"}
              properties={propertyOptions}
              defaultPropertyId={selectedPropertyId}
            />
          </div>
        )}
      />

      {canManageCompanies && <CompanyList companies={companies} />}

      {!hasActiveCompany && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex gap-3 p-4">
            <Building2 className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium">{i18n("auto.m0075")}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{i18n("auto.m0076")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3" aria-labelledby="property-list-heading">
        <div>
          <h2 id="property-list-heading" className="text-lg font-semibold">{i18n("propertyRooms.buildingsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{i18n("propertyRooms.selectBuilding")}</p>
        </div>
        <PropertyList
          properties={properties}
          companies={companyOptions}
          selectedPropertyId={selectedPropertyId}
        />
      </section>

      {selectedProperty && (
        <section id="rooms" className="scroll-mt-6 space-y-3" aria-labelledby="selected-property-rooms-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="selected-property-rooms-heading" className="text-lg font-semibold">
                {i18n("propertyRooms.roomSectionTitle", { name: selectedProperty.name })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {i18n("propertyRooms.roomSectionDescription", { name: selectedProperty.name })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button nativeButton={false} render={<Link href="/properties" />} variant="outline">
                {i18n("propertyRooms.allBuildings")}
              </Button>
              <RoomCreateDialog properties={propertyOptions} defaultPropertyId={selectedProperty.id} />
            </div>
          </div>
          <RoomList
            rooms={rooms}
            properties={propertyOptions}
            canManageCalendarSources={canManageCalendarSources}
          />
        </section>
      )}
    </div>
  );
}
