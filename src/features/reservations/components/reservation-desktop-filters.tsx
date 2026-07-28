"use client";import { useTranslations } from "next-intl";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EMPTY_RESERVATION_FILTERS, type ReservationFilterState } from "../reservation-filter-query";
import { ReservationFilterFields, type ReservationPropertyOption, type ReservationProviderOption, type ReservationRoomOption } from "./reservation-filter-fields";
import { ReservationSearchInput } from "./reservation-search-input";

export function ReservationDesktopFilters({ filters, effectiveDateRange, properties, rooms, providers, onApply, onReset







}: {filters: ReservationFilterState;effectiveDateRange: {from: string;to: string;};properties: ReservationPropertyOption[];rooms: ReservationRoomOption[];providers: ReservationProviderOption[];onApply: (filters: ReservationFilterState) => void;onReset: () => void;}) {const i18n = useTranslations();
  const [draft, setDraft] = useState(filters);
  return (
    <section className="hidden rounded-xl border bg-card p-4 lg:block" aria-label={i18n("auto.m0402")}>
      <div className="mb-4 flex items-center gap-3">
        <ReservationSearchInput id="desktop-reservation-search" value={draft.search} onSearch={(search) => setDraft((current) => ({ ...current, search }))} />
        <Button type="button" variant="outline" onClick={() => {setDraft(EMPTY_RESERVATION_FILTERS);onReset();}}><RotateCcw />{i18n("auto.m0403")}</Button>
        <Button type="button" onClick={() => onApply(draft)}>{i18n("auto.m0087")}</Button>
      </div>
      <ReservationFilterFields compact value={draft} onChange={setDraft} properties={properties} rooms={rooms} providers={providers} effectiveDateRange={effectiveDateRange} />
    </section>);

}
