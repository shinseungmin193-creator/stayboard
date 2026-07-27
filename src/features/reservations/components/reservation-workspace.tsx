"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { EMPTY_RESERVATION_FILTERS, serializeReservationFilters, type ReservationFilterState } from "../reservation-filter-query";
import type { ReservationViewModel } from "../reservation-view-model";
import { ActiveReservationFilters } from "./active-reservation-filters";
import { ReservationDesktopFilters } from "./reservation-desktop-filters";
import { ReservationDetailSheet } from "./reservation-detail-sheet";
import { ReservationEmptyState } from "./reservation-empty-state";
import type { ReservationPropertyOption, ReservationProviderOption, ReservationRoomOption } from "./reservation-filter-fields";
import { ReservationList } from "./reservation-list";
import { ReservationLoadMore } from "./reservation-load-more";
import { ReservationPageToolbar } from "./reservation-page-toolbar";

interface ReservationPageResult {
  items: ReservationViewModel[];
  totalCount: number;
  totalPages: number;
  page: number;
}

export function ReservationWorkspace({ initialFilters, effectiveDateRange, initialResult, hasAnyReservations, properties, rooms, providers }: {
  initialFilters: ReservationFilterState;
  effectiveDateRange: { from: string; to: string };
  initialResult: ReservationPageResult;
  hasAnyReservations: boolean;
  properties: ReservationPropertyOption[];
  rooms: ReservationRoomOption[];
  providers: ReservationProviderOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const [reservations, setReservations] = useState(initialResult.items);
  const [loadedPage, setLoadedPage] = useState(initialResult.page);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReservationViewModel | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  const showNotice = (message: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(null), 2400);
  };

  const navigate = (next: ReservationFilterState) => {
    setFilters(next);
    setSelected(null);
    const params = serializeReservationFilters(next);
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false }));
  };

  const reset = () => {
    navigate(EMPTY_RESERVATION_FILTERS);
    showNotice("모든 필터가 초기화되었습니다.");
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const params = serializeReservationFilters(filters);
      params.set("page", String(loadedPage + 1));
      const response = await fetch(withBasePath(`/api/reservations?${params}`), { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("예약을 더 불러오지 못했습니다.");
      const next = await response.json() as ReservationPageResult;
      setReservations((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...next.items.filter((item) => !existing.has(item.id))];
      });
      setLoadedPage(next.page);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "예약을 더 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  };

  const hasFilters = serializeReservationFilters(filters).size > 0;
  const remainingCount = Math.max(0, initialResult.totalCount - reservations.length);

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReservationPageToolbar filters={filters} effectiveDateRange={effectiveDateRange} properties={properties} rooms={rooms} providers={providers} onChange={navigate} onReset={reset} />
      <ReservationDesktopFilters filters={filters} effectiveDateRange={effectiveDateRange} properties={properties} rooms={rooms} providers={providers} onApply={navigate} onReset={reset} />
      <ActiveReservationFilters filters={filters} properties={properties} rooms={rooms} providers={providers} onChange={navigate} />
      <div className="flex min-h-7 items-center justify-between gap-3">
        <p className="text-sm font-semibold">총 {initialResult.totalCount.toLocaleString("ko-KR")}건</p>
        {isPending && <span className="flex items-center gap-1 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />목록 갱신 중</span>}
      </div>
      {reservations.length ? <ReservationList reservations={reservations} onSelect={setSelected} /> : <ReservationEmptyState hasAnyReservations={hasAnyReservations} hasFilters={hasFilters} onReset={reset} />}
      <ReservationLoadMore remainingCount={remainingCount} loading={loadingMore} error={loadError} onLoadMore={loadMore} />
      <ReservationDetailSheet reservation={selected} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} />
      {notice && <div className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-sm rounded-lg bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-lg lg:bottom-6" role="status" aria-live="polite">{notice}</div>}
    </div>
  );
}
