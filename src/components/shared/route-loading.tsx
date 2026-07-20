import { Skeleton } from "@/components/ui/skeleton";
export function RouteLoading() { return <div className="space-y-5"><div className="space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-72" /></div><Skeleton className="h-24 w-full" /><Skeleton className="h-80 w-full" /></div>; }
