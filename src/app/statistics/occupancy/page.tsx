import { getTranslations } from "next-intl/server";import { PageHeader } from "@/components/shared/page-header";
import { listPropertyOptions } from "@/features/properties";
import { listOccupancyStatistics, resolveOccupancyPeriod } from "@/features/statistics/occupancy";
import { OccupancyFilters } from "@/features/statistics/occupancy/components/occupancy-filters";
import { OccupancySummaryCards } from "@/features/statistics/occupancy/components/occupancy-summary-cards";
import { RoomOccupancyTable } from "@/features/statistics/occupancy/components/room-occupancy-table";
import { AccessDenied, authorizeAccess, companyScopeIds, getCurrentAccessContext, PERMISSIONS } from "@/features/access-control";
import { DEMO_PROPERTY_OPTIONS, getDemoOccupancyData } from "@/features/demo";
export const dynamic = "force-dynamic";
export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("navigation.items.occupancy-statistics") }; }
export default async function OccupancyStatisticsPage({ searchParams }: {searchParams: Promise<Record<string, string | string[] | undefined>>;}) {const i18n = await getTranslations();
  const context = await getCurrentAccessContext();const access = context ? await authorizeAccess(PERMISSIONS.STATISTICS_READ) : null;if (access && !access.allowed) return <AccessDenied role={access.context?.role ?? null} />;const companyIds = context ? companyScopeIds(context) : undefined;
  const params = await searchParams;const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const properties = context ? await listPropertyOptions(companyIds, context.scope) : DEMO_PROPERTY_OPTIONS;const rawPropertyId = value("propertyId");const propertyId = properties.some((item) => item.id === rawPropertyId && item.isActive) ? rawPropertyId : undefined;
  const selection = resolveOccupancyPeriod({ period: value("period"), from: value("from"), to: value("to") });
  const result = context ? await listOccupancyStatistics({ propertyId, query: value("query"), companyIds, accessScope: context.scope }, selection.period) : getDemoOccupancyData(selection.period, value("query"));
  return <div className="space-y-4"><PageHeader title={i18n("navigation.items.occupancy-statistics")} description={i18n("auto.m0121")} /><OccupancyFilters properties={properties} propertyId={propertyId} query={value("query")} periodKey={selection.key} from={selection.period.startLabel} to={selection.period.endLabel} /><OccupancySummaryCards metric={result.metric} period={selection.period} /><RoomOccupancyTable metric={result.metric} emptyReason={result.emptyReason} /></div>;
}
