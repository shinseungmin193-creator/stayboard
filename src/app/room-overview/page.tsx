import { getTranslations } from "next-intl/server";import type { RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { BedDouble } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { AccessDenied, authorizeAccess, authorizeSidebarMenuAccess, companyScopeIds, getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import { DEMO_PROPERTY_OPTIONS, getDemoRoomOverview } from "@/features/demo";
import { RoomOverviewDeveloperSettingsBoundary } from "@/features/developer-settings";
import { listPropertyOptions } from "@/features/properties";
import { listRoomOverview, ROOM_OVERVIEW_STATUS_PRIORITY, type RoomOverviewStatus } from "@/features/room-overview";
import { RoomOverviewCardGrid } from "@/features/room-overview/components/room-overview-card-grid";
import { RoomOverviewSchedule } from "@/features/room-overview/components/room-overview-schedule";
import { RoomOverviewSettingsLayout } from "@/features/room-overview/components/room-overview-settings-layout";
import { RoomOverviewToolbar } from "@/features/room-overview/components/room-overview-toolbar";
import { MobileRoomStatusWorkspace } from "@/features/room-overview/components/mobile-room-status-workspace";
import { MOBILE_ROOM_OTA_FILTERS, MOBILE_ROOM_STATUS_FILTERS, MOBILE_ROOM_SYNC_FILTERS, parseCalendarRangeDays, parseRoomOverviewDateKey, roomOverviewDateInstant, roomOverviewDateKey, type MobileRoomFilters } from "@/features/room-overview/domain/room-overview-mobile";
import { isCalendarProviderType } from "@/providers/calendar";

export const dynamic = "force-dynamic";
export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("navigation.items.room-overview") }; }

const syncStatuses = ["RUNNING", "SUCCESS", "FAILED", "TIMEOUT"] as const;
const operationalStatuses = ["NONE", "CLEANING_REQUIRED", "INSPECTION_REQUIRED"] as const;

export default async function RoomOverviewPage({ searchParams }: {searchParams: Promise<Record<string, string | string[] | undefined>>;}) {const i18n = await getTranslations();
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const context = await getCurrentAccessContext();
  const roomAccess = context ? await authorizeSidebarMenuAccess("room-overview") : null;
  if (roomAccess && !roomAccess.allowed) return <AccessDenied role={roomAccess.context?.role ?? null} />;
  const properties = context ? await listPropertyOptions(companyScopeIds(context), context.scope) : DEMO_PROPERTY_OPTIONS;
  const rawPropertyId = value("propertyId");
  const propertyId = properties.some((item) => item.id === rawPropertyId && item.isActive) ? rawPropertyId : undefined;
  const rawStatus = value("status");
  const rawProvider = value("provider");
  const rawSyncStatus = value("syncStatus");
  const rawOperationalStatus = value("operationalStatus");
  const today = roomOverviewDateKey();
  const selectedDate = parseRoomOverviewDateKey(value("date"), today);
  const calendarRange = parseCalendarRangeDays(value("range"));
  const selectedDateInstant = roomOverviewDateInstant(selectedDate);
  const filters = {
    propertyId,
    query: value("query"),
    status: ROOM_OVERVIEW_STATUS_PRIORITY.includes(rawStatus as RoomOverviewStatus) ? rawStatus as RoomOverviewStatus : undefined,
    operationalStatus: operationalStatuses.includes(rawOperationalStatus as RoomOperationalStatus) ? rawOperationalStatus as RoomOperationalStatus : undefined,
    provider: rawProvider && isCalendarProviderType(rawProvider) ? rawProvider : undefined,
    syncStatus: syncStatuses.includes(rawSyncStatus as SyncStatus) ? rawSyncStatus as SyncStatus : undefined
  };
  const result = context ? await listRoomOverview({ ...filters, companyIds: companyScopeIds(context), accessScope: context.scope }, selectedDateInstant, calendarRange) : getDemoRoomOverview(filters, selectedDateInstant);
  const currentParams = Object.entries(params).flatMap(([key, item]) => typeof item === "string" && item ? [[key, item] as [string, string]] : []);
  const rawMobileStatus = value("mobileStatus");
  const rawOta = value("ota");
  const rawSyncError = value("syncError");
  const mobileFilters: MobileRoomFilters = {
    query: value("query") ?? "",
    status: MOBILE_ROOM_STATUS_FILTERS.includes(rawMobileStatus as MobileRoomFilters["status"]) ? rawMobileStatus as MobileRoomFilters["status"] : "ALL",
    ota: MOBILE_ROOM_OTA_FILTERS.includes(rawOta as MobileRoomFilters["ota"]) ? rawOta as MobileRoomFilters["ota"] : "ALL",
    sync: MOBILE_ROOM_SYNC_FILTERS.includes(rawSyncError as MobileRoomFilters["sync"]) ? rawSyncError as MobileRoomFilters["sync"] : "ALL"
  };
  const canSync = hasPermission(context?.role, PERMISSIONS.SYNC_RUN);
  const roomNoteAccess = context ? await authorizeAccess(PERMISSIONS.ROOM_NOTE_READ) : null;
  const canReadRoomNotes = roomNoteAccess?.allowed ?? false;
  const canCompleteRoomNotes = canReadRoomNotes && hasPermission(context?.role, PERMISSIONS.ROOM_NOTE_COMPLETE);

  return (
    <RoomOverviewDeveloperSettingsBoundary enabled={context?.actualRole === "DEVELOPER"}>
      <div className="space-y-4 xl:space-y-2">
        <MobileRoomStatusWorkspace key={propertyId ?? "all-properties"} rooms={result.allCards} properties={properties} selectedDate={selectedDate} today={today} propertyId={propertyId} queryView={value("view")} calendarRange={calendarRange} hasCalendarRangeQuery={Boolean(value("range"))} initialFilters={mobileFilters} canSync={canSync} canReadRoomNotes={canReadRoomNotes} canCompleteRoomNotes={canCompleteRoomNotes} />
        <div className="hidden xl:block">
          <RoomOverviewToolbar properties={properties} filters={filters} summary={result.summary} currentParams={currentParams} canSync={canSync} />
          <RoomOverviewSettingsLayout
            schedulePanel={<RoomOverviewSchedule schedule={result.operationalSchedule} conflicts={result.conflicts} />}>
            
            <section className="min-w-0" aria-label={i18n("auto.m0091")}>{result.cards.length ? <RoomOverviewCardGrid cards={result.cards} canUpdateOperationalStatus={hasPermission(context?.role, PERMISSIONS.ROOM_OPERATIONAL_STATUS_UPDATE)} canReadRoomNotes={canReadRoomNotes} canCompleteRoomNotes={canCompleteRoomNotes} /> : <div className="flex min-h-80 items-center rounded-xl border bg-card"><EmptyState icon={BedDouble} title={i18n("auto.m0092")} description={i18n("auto.m0093")} /></div>}</section>
          </RoomOverviewSettingsLayout>
        </div>
      </div>
    </RoomOverviewDeveloperSettingsBoundary>);

}
