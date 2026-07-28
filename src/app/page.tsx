import { getTranslations } from "next-intl/server";import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, companyScopeIds, getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";
import { getDashboardSummary } from "@/features/dashboard/dashboard.repository";
import { DashboardCleaningCard } from "@/features/dashboard/components/dashboard-cleaning-card";
import { getDashboardDateInput } from "@/features/dashboard/dashboard-time";
import { getDemoDashboardData } from "@/features/demo";
import type { DashboardStatCardData } from "@/features/dashboard/dashboard-stat-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {const i18n = await getTranslations();
  const context = await getCurrentAccessContext();
  const access = context ? await authorizeAccess(PERMISSIONS.RESERVATION_READ) : null;
  if (access && !access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const summary = context ? await getDashboardSummary(new Date(), companyScopeIds(context), context.scope) : getDemoDashboardData();
  const today = getDashboardDateInput(new Date());
  const statistics: DashboardStatCardData[] = [
  { label: i18n("reservation.statuses.CHECK_IN_TODAY"), count: summary.todayCheckIns, iconName: "checkin", href: `/reservations?dateField=checkIn&from=${today}&to=${today}`, rooms: [] },
  { label: i18n("reservation.statuses.CHECK_OUT_TODAY"), count: summary.todayCheckOuts, iconName: "checkout", href: `/reservations?dateField=checkOut&from=${today}&to=${today}`, rooms: [] },
  { label: i18n("conflict.label"), count: summary.activeConflicts, iconName: "overbooking", href: "/reservation-conflicts", rooms: [] },
  { label: i18n("auto.m0063", { value0: summary.recentFailureHours }), count: summary.recentSyncFailures, iconName: "sync-failure", href: `/calendar-sources?logStatus=FAILED&hours=${summary.recentFailureHours}`, rooms: [] }];

  const priorityCleaning: DashboardStatCardData = { label: i18n("auto.m0064"), count: summary.priorityCleaning, description: i18n("auto.m0065"), iconName: "priority-cleaning", iconClassName: "text-orange-600 dark:text-orange-400", rooms: summary.priorityCleaningRooms };
  const flexibleCleaning: DashboardStatCardData = { label: i18n("auto.m0066"), count: summary.flexibleCleaning, description: i18n("auto.m0067"), iconName: "flexible-cleaning", iconClassName: "text-teal-600 dark:text-teal-400", rooms: summary.flexibleCleaningRooms };
  const canManageProperties = hasPermission(context?.role, PERMISSIONS.PROPERTY_MANAGE);
  const propertyAction = canManageProperties ?
  <Button nativeButton={false} render={<Link href="/properties" />} className="w-full sm:w-auto">{i18n("auto.m0068")}<ArrowRight /></Button> :
  !context ? <AuthTrigger mode="signup" className="w-full sm:w-auto">{i18n("auto.m0069")}<ArrowRight /></AuthTrigger> : undefined;
  return <div className="space-y-5"><PageHeader eyebrow="OVERVIEW" title={i18n("common.dashboard")} description={i18n("auto.m0071")} action={propertyAction} /><section aria-label={i18n("auto.m0072")} className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3"><StatCard data={statistics[0]} /><StatCard data={statistics[1]} /><StatCard data={statistics[2]} /><DashboardCleaningCard data={priorityCleaning} /><DashboardCleaningCard data={flexibleCleaning} /><StatCard data={statistics[3]} /></section></div>;
}
