"use client";

import type { ReservationFilterState } from "../reservation-filter-query";
import { ReservationFilterSheet } from "./reservation-filter-sheet";
import type { ReservationPropertyOption, ReservationProviderOption, ReservationRoomOption } from "./reservation-filter-fields";
import { ReservationQuickFilterSheet } from "./reservation-quick-filter-sheet";
import { ReservationSearchInput } from "./reservation-search-input";

export function ReservationPageToolbar({ filters, effectiveDateRange, properties, rooms, providers, onChange, onReset }: {
  filters: ReservationFilterState;
  effectiveDateRange: { from: string; to: string };
  properties: ReservationPropertyOption[];
  rooms: ReservationRoomOption[];
  providers: ReservationProviderOption[];
  onChange: (filters: ReservationFilterState) => void;
  onReset: () => void;
}) {
  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 -mx-3 border-y bg-background/95 px-3 py-2 backdrop-blur lg:hidden">
      <div className="flex min-w-0 gap-2">
        <ReservationFilterSheet filters={filters} effectiveDateRange={effectiveDateRange} properties={properties} rooms={rooms} providers={providers} onApply={onChange} onReset={onReset} />
        <ReservationSearchInput value={filters.search} onSearch={(search) => onChange({ ...filters, search })} />
        <ReservationQuickFilterSheet filters={filters} onApply={onChange} />
      </div>
    </div>
  );
}
