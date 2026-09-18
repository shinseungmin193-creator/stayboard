"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { CalendarProviderType, RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar/types";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { ROOM_OVERVIEW_STATUS_PRIORITY, type RoomOverviewStatus } from "../domain/room-overview";
import { updateRoomOverviewFilterParams, type RoomOverviewSelectFilterKey } from "../domain/room-overview-filter";

const syncStatuses = ["RUNNING", "SUCCESS", "FAILED", "TIMEOUT"] as const;

export interface RoomOverviewFilterValues {
  propertyId?: string;
  query?: string;
  status?: RoomOverviewStatus;
  operationalStatus?: RoomOperationalStatus;
  provider?: CalendarProviderType;
  syncStatus?: SyncStatus;
}

export function RoomOverviewFilterForm({ properties, filters, currentParams, showOperational = false, className }: {
  properties: Array<{ id: string; name: string; isActive: boolean }>;
  filters: RoomOverviewFilterValues;
  currentParams: Array<[string, string]>;
  showOperational?: boolean;
  className?: string;
}) {
  const i18n = useTranslations();
  const router = useRouter();
  const serializedParams = new URLSearchParams(currentParams).toString();
  const paramsRef = useRef(new URLSearchParams(serializedParams));

  useEffect(() => {
    if (window.location.search.slice(1) === serializedParams) {
      paramsRef.current = new URLSearchParams(serializedParams);
    }
  }, [serializedParams]);

  const replaceFilter = (key: RoomOverviewSelectFilterKey | "query", value: string) => {
    const params = updateRoomOverviewFilterParams(paramsRef.current, key, value);
    paramsRef.current = params;
    router.replace(params.size ? `/room-overview?${params.toString()}` : "/room-overview", { scroll: false });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get("query") ?? "").trim();
    replaceFilter("query", query);
  };

  return <form onSubmit={submitSearch} className={className}>
    <select key={`propertyId:${filters.propertyId ?? ""}`} name="propertyId" defaultValue={filters.propertyId ?? ""} onChange={(event) => replaceFilter("propertyId", event.target.value)} aria-label={i18n("auto.m0078")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0079")}</option>{properties.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <label className="relative min-w-0"><Search className="pointer-events-none absolute left-2.5 top-2 size-3.5 text-muted-foreground" /><input key={`query:${filters.query ?? ""}`} name="query" defaultValue={filters.query ?? ""} aria-label={i18n("auto.m0492")} placeholder={i18n("auto.m0492")} className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs" /></label>
    <select key={`status:${filters.status ?? ""}`} name="status" defaultValue={filters.status ?? ""} onChange={(event) => replaceFilter("status", event.target.value)} aria-label={i18n("auto.m0493")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0244")}</option>{ROOM_OVERVIEW_STATUS_PRIORITY.map((status) => <option key={status} value={status}>{i18n(`roomStatus.${status}`)}</option>)}</select>
    <select key={`provider:${filters.provider ?? ""}`} name="provider" defaultValue={filters.provider ?? ""} onChange={(event) => replaceFilter("provider", event.target.value)} aria-label={i18n("auto.m0082")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0083")}</option>{CALENDAR_PROVIDER_TYPES.map((provider) => <option key={provider} value={provider}>{getProviderLabel(provider, i18n)}</option>)}</select>
    <select key={`syncStatus:${filters.syncStatus ?? ""}`} name="syncStatus" defaultValue={filters.syncStatus ?? ""} onChange={(event) => replaceFilter("syncStatus", event.target.value)} aria-label={i18n("auto.m0494")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0495")}</option>{syncStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
    {showOperational && <select key={`operationalStatus:${filters.operationalStatus ?? ""}`} name="operationalStatus" defaultValue={filters.operationalStatus ?? ""} onChange={(event) => replaceFilter("operationalStatus", event.target.value)} aria-label={i18n("auto.m0496")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0497")}</option><option value="NONE">{i18n("auto.m0498")}</option><option value="CLEANING_REQUIRED">{i18n("roomStatus.CLEANING_REQUIRED")}</option><option value="INSPECTION_REQUIRED">{i18n("roomStatus.INSPECTION_REQUIRED")}</option></select>}
    <Button type="submit" size="sm" variant="outline">{i18n("roomOverviewFilters.searchButton")}</Button>
  </form>;
}
