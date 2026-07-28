"use client";import { useTranslations } from "next-intl";

import { Search, X } from "lucide-react";
import { useReservationSearch } from "../hooks/use-reservation-search";

export function ReservationSearchInput({ value, onSearch, id = "reservation-search" }: {value: string;onSearch: (value: string) => void;id?: string;}) {const i18n = useTranslations();
  const search = useReservationSearch(value, onSearch);
  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-muted-foreground" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={search.draft}
        onChange={(event) => search.update(event.target.value)}
        onKeyDown={(event) => {if (event.key === "Enter") {event.preventDefault();search.submit();}}}
        placeholder={i18n("auto.m0450")}
        aria-label={i18n("auto.m0451")}
        className="h-11 w-full rounded-lg border border-input bg-background pr-10 pl-9 text-base outline-none placeholder:text-sm focus:border-ring focus:ring-2 focus:ring-ring/30" />
      
      {search.draft && <button type="button" onClick={search.clear} className="absolute top-0 right-0 grid size-11 place-items-center text-muted-foreground" aria-label={i18n("auto.m0452")}><X className="size-4" /></button>}
    </div>);

}
