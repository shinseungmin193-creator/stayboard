import { ArrowRight, BedDouble, CalendarDays, CalendarX2, LogIn, LogOut, RefreshCw } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const statistics = [
  { label: "오늘 체크인", value: "0건", icon: LogIn }, { label: "오늘 체크아웃", value: "0건", icon: LogOut },
  { label: "예약 충돌", value: "0건", icon: CalendarX2 }, { label: "등록 객실", value: "0개", icon: BedDouble },
] as const;

export default function DashboardPage() {
  return <div className="space-y-5">
    <PageHeader eyebrow="OVERVIEW" title="대시보드" description="오늘의 예약 현황과 캘린더 연결 상태를 확인하세요." action={<Button render={<Link href="/properties" />} className="w-full sm:w-auto">숙소 등록 시작 <ArrowRight /></Button>} />
    <section aria-label="오늘의 운영 현황" className="grid grid-cols-2 gap-3 xl:grid-cols-4">{statistics.map((stat) => <StatCard key={stat.label} {...stat} />)}</section>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-h-[360px]"><CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4 text-muted-foreground" />객실 캘린더</CardTitle></CardHeader><CardContent className="flex min-h-[290px] items-center justify-center p-5"><EmptyState icon={CalendarDays} title="표시할 객실 캘린더가 없습니다" description="숙소와 객실을 등록한 뒤 OTA 캘린더를 연결하면 예약 일정을 한곳에서 확인할 수 있습니다." actionLabel="숙소 등록 시작" actionHref="/properties" /></CardContent></Card>
      <Card className="h-fit"><CardHeader><CardTitle className="text-base">동기화 상태</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-3 rounded-lg border bg-muted/35 p-3"><div className="grid size-9 shrink-0 place-items-center rounded-md bg-background"><RefreshCw className="size-4 text-muted-foreground" /></div><div><p className="text-sm font-medium">최근 동기화</p><p className="text-sm text-muted-foreground">없음</p></div></div><p className="text-xs leading-5 text-muted-foreground">연결된 캘린더가 생기면 마지막 동기화 시각과 처리 결과가 표시됩니다.</p></CardContent></Card>
    </section>
  </div>;
}
