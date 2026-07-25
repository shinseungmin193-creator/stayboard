"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { dashboardStatIconMap } from "../dashboard-stat-icons";
import type { DashboardStatCardData } from "../dashboard-stat-card";
import { cn } from "@/lib/utils";

export function DashboardCleaningCard({ data }: { data: DashboardStatCardData }) {
  const Icon = dashboardStatIconMap[data.iconName];
  return <Card><CardContent className="flex items-start justify-between p-4 sm:p-5"><div><p className="text-xs font-medium text-muted-foreground sm:text-sm">{data.label}</p><p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{data.count}건</p>{data.description && <p className="mt-1 text-xs text-muted-foreground">{data.description}</p>}</div><Dialog><DialogTrigger render={<button type="button" className="grid size-9 shrink-0 place-items-center rounded-md bg-muted outline-none transition-colors hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${data.label} 객실 상세보기`} />}><Icon className={cn("size-4", data.iconClassName)} /><span className="sr-only">상세보기</span></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{data.label} 객실</DialogTitle><DialogDescription>{data.description} · {data.count}개 객실</DialogDescription></DialogHeader><div className="max-h-80 space-y-2 overflow-y-auto">{data.rooms.map((room) => <div key={room.id} className="rounded-lg border p-3"><p className="font-medium">{room.name}</p><p className="text-xs text-muted-foreground">{room.propertyName}</p></div>)}{data.rooms.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">해당 객실이 없습니다.</p>}</div></DialogContent></Dialog></CardContent></Card>;
}
