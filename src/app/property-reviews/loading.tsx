import { Skeleton } from "@/components/ui/skeleton";

export default function PropertyReviewsLoading() {
  return <div className="space-y-5" aria-busy="true">
    <div className="space-y-2 border-b pb-5"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div>
    <Skeleton className="h-24 w-full rounded-xl" />
    <div className="grid gap-3 md:hidden">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-64 w-full rounded-xl" />)}</div>
    <Skeleton className="hidden h-96 w-full rounded-xl md:block" />
  </div>;
}
