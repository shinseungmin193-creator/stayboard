"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { dashboardStatIconMap } from "@/features/dashboard/dashboard-stat-icons";
import type { DashboardStatCardData } from "@/features/dashboard/dashboard-stat-card";
import { cn } from "@/lib/utils";

export function StatCard({ data }: { data: DashboardStatCardData }) {
  const Icon = dashboardStatIconMap[data.iconName];
  const card = <Card className={cn(data.href && "h-full transition-colors group-hover/stat-link:bg-muted/30")}><CardContent className="flex min-w-0 items-start justify-between gap-2 p-3 sm:p-5"><div className="min-w-0"><p className="break-keep text-[11px] font-medium leading-4 text-muted-foreground sm:text-sm">{data.label}</p><p className="mt-1.5 text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl">{data.count}건</p>{data.description && <p className="mt-1 hidden text-xs text-muted-foreground min-[390px]:block">{data.description}</p>}</div><div className="grid size-8 shrink-0 place-items-center rounded-md bg-muted sm:size-9"><Icon className={cn("size-4 text-muted-foreground", data.iconClassName)} /></div></CardContent></Card>;

  if (!data.href) return card;

  const activateWithSpace = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== " ") return;
    event.preventDefault();
    event.currentTarget.click();
  };

  return <Link href={data.href} aria-label={`${data.label} ${data.count}건 보기`} className="group/stat-link block cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onKeyDown={activateWithSpace}>{card}</Link>;
}
