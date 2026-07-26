import { ArrowRight } from "lucide-react";
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
import { RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";
import type { DashboardStatCardData } from "@/features/dashboard/dashboard-stat-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const context = await getCurrentAccessContext();
  const access = context ? await authorizeAccess(PERMISSIONS.RESERVATION_READ) : null;
  if (access && !access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const summary = context ? await getDashboardSummary(new Date(), companyScopeIds(context), context.scope) : getDemoDashboardData();
  const today = getDashboardDateInput(new Date());
  const statistics: DashboardStatCardData[] = [
    { label: "오늘 체크인", count: summary.todayCheckIns, iconName: "checkin", href: `/reservations?dateField=checkIn&from=${today}&to=${today}`, rooms: [] },
    { label: "오늘 체크아웃", count: summary.todayCheckOuts, iconName: "checkout", href: `/reservations?dateField=checkOut&from=${today}&to=${today}`, rooms: [] },
    { label: RESERVATION_CONFLICT_UI.label, count: summary.activeConflicts, iconName: "overbooking", href: "/reservation-conflicts", rooms: [] },
    { label: `${summary.recentFailureHours}시간 동기화 실패`, count: summary.recentSyncFailures, iconName: "sync-failure", href: `/calendar-sources?logStatus=FAILED&hours=${summary.recentFailureHours}`, rooms: [] },
  ];
  const priorityCleaning: DashboardStatCardData = { label: "우선 청소", count: summary.priorityCleaning, description: "오늘 체크인 전 완료", iconName: "priority-cleaning", iconClassName: "text-orange-600 dark:text-orange-400", rooms: summary.priorityCleaningRooms };
  const flexibleCleaning: DashboardStatCardData = { label: "여유 청소", count: summary.flexibleCleaning, description: "오늘 체크인 일정 없음", iconName: "flexible-cleaning", iconClassName: "text-teal-600 dark:text-teal-400", rooms: summary.flexibleCleaningRooms };
  const canManageProperties = hasPermission(context?.role, PERMISSIONS.PROPERTY_MANAGE);
  const propertyAction = canManageProperties
    ? <Button nativeButton={false} render={<Link href="/properties" />} className="w-full sm:w-auto">숙소 등록 시작 <ArrowRight /></Button>
    : !context ? <AuthTrigger mode="signup" className="w-full sm:w-auto">무료로 숙소 운영 시작 <ArrowRight /></AuthTrigger> : undefined;
  return <div className="space-y-5"><PageHeader eyebrow="OVERVIEW" title="대시보드" description="오늘의 예약과 운영 현황을 확인하세요." action={propertyAction} /><section aria-label="오늘의 운영 현황" className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3"><StatCard data={statistics[0]} /><StatCard data={statistics[1]} /><StatCard data={statistics[2]} /><DashboardCleaningCard data={priorityCleaning} /><DashboardCleaningCard data={flexibleCleaning} /><StatCard data={statistics[3]} /></section></div>;
}
