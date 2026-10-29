import { Skeleton } from "@/components/ui/skeleton";

const DASHBOARD_CARD_SKELETONS = 8;

export default function DashboardLoading() {
  return <div className="space-y-5" aria-busy="true" aria-label="대시보드를 불러오는 중입니다">
    <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-9 w-full sm:w-32" />
    </div>
    <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: DASHBOARD_CARD_SKELETONS }, (_, index) => (
        <div key={index} className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </section>
  </div>;
}
