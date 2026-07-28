"use client";import { useTranslations } from "next-intl";
import { useState } from "react";
import { CalendarDays, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OCCUPANCY_PERIOD_OPTIONS, type OccupancyPeriodKey } from "../domain/occupancy-period";

export function OccupancyFilters({ properties, propertyId, query, periodKey, from, to }: {properties: Array<{id: string;name: string;isActive: boolean;}>;propertyId?: string;query?: string;periodKey: OccupancyPeriodKey;from?: string;to?: string;}) {const i18n = useTranslations();
  const [selectedPeriod, setSelectedPeriod] = useState(periodKey);
  const custom = selectedPeriod === "custom";
  return <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 lg:grid-cols-[150px_180px_minmax(180px,280px)_140px_140px_auto] lg:items-end">
    <label className="grid gap-1 text-xs font-medium">{i18n("auto.m0610")}<select name="period" value={selectedPeriod} onChange={(event) => setSelectedPeriod(event.target.value as OccupancyPeriodKey)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">{OCCUPANCY_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium">{i18n("common.property")}<select name="propertyId" defaultValue={propertyId ?? ""} className="h-8 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0079")}</option>{properties.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium">{i18n("auto.m0492")}<span className="relative"><Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" /><input name="query" defaultValue={query ?? ""} placeholder={i18n("auto.m0611")} className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs" /></span></label>
    <label className="grid gap-1 text-xs font-medium">{i18n("auto.m0436")}<input type="date" name="from" required={custom} disabled={!custom} defaultValue={periodKey === "custom" ? from : ""} className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50" /></label>
    <label className="grid gap-1 text-xs font-medium">{i18n("auto.m0437")}<input type="date" name="to" required={custom} disabled={!custom} defaultValue={periodKey === "custom" ? to : ""} className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50" /></label>
    <div className="flex gap-1"><Button type="submit" size="sm" className="flex-1"><CalendarDays />{i18n("auto.m0116")}</Button><Button type="submit" size="icon-sm" variant="outline" aria-label={i18n("auto.m0612")}><RefreshCw /></Button></div>
  </form>;
}
