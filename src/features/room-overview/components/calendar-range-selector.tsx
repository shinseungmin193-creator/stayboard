"use client";import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CALENDAR_RANGE_OPTIONS, type CalendarRangeDays } from "../domain/room-overview-mobile";

export function CalendarRangeSelector({ value, onChange }: {value: CalendarRangeDays;onChange: (range: CalendarRangeDays) => void;}) {const i18n = useTranslations();
  return <div className="grid grid-cols-4 rounded-lg bg-muted p-1" role="group" aria-label={i18n("auto.m0457")}>
    {CALENDAR_RANGE_OPTIONS.map((range) => <Button key={range} type="button" size="xs" variant="ghost" aria-pressed={range === value} onClick={() => onChange(range)} className={cn("min-h-8 px-2 text-[11px]", range === value && "bg-background text-primary shadow-sm hover:bg-background")}>{range}{i18n("auto.m0458")}</Button>)}
  </div>;
}
