"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatReservationNavigationDate,
  getNextReservationDate,
  getPreviousReservationDate,
  getReservationRelativeDate,
  reservationDateNavigationHref,
  type ReservationDateMode,
} from "../reservation-date-navigation";

export interface ReservationDateNavigatorProps {
  mode: ReservationDateMode;
  selectedDate: string;
  today: string;
  count: number;
}

export function ReservationDateNavigator({ mode, selectedDate, today, count }: ReservationDateNavigatorProps) {
  const locale = useLocale();
  const t = useTranslations();
  const searchParams = useSearchParams();
  const relativeDate = getReservationRelativeDate(selectedDate, today);
  const yesterday = getPreviousReservationDate(today);
  const tomorrow = getNextReservationDate(today);
  const targets = [
    { key: "previous", date: getPreviousReservationDate(selectedDate), label: t("reservation.dateNavigation.previous"), icon: ChevronLeft },
    { key: "yesterday", date: yesterday, label: t("common.yesterday") },
    { key: "today", date: today, label: t("common.today") },
    { key: "tomorrow", date: tomorrow, label: t("common.tomorrow") },
    { key: "next", date: getNextReservationDate(selectedDate), label: t("reservation.dateNavigation.next"), icon: ChevronRight },
  ] as const;
  const modeLabel = mode === "checkout" ? t("reservation.checkOut") : t("reservation.checkIn");
  const dateLabel = formatReservationNavigationDate(selectedDate, locale === "ja" ? "ja" : "ko");

  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-2.5 lg:flex-row lg:items-center lg:justify-between" aria-label={t("reservation.dateNavigation.ariaLabel")}>
      <nav className="grid grid-cols-[2.75rem_repeat(3,minmax(0,1fr))_2.75rem] gap-1 lg:w-auto lg:grid-cols-[2.75rem_repeat(3,4.5rem)_2.75rem]" aria-label={t("reservation.dateNavigation.ariaLabel")}>
        {targets.map((target) => {
          const selected = target.key === relativeDate;
          const Icon = "icon" in target ? target.icon : null;
          return (
            <Link
              key={target.key}
              href={reservationDateNavigationHref(searchParams, mode, target.date)}
              scroll={false}
              aria-label={target.label}
              aria-current={selected ? "date" : undefined}
              className={cn(
                buttonVariants({ variant: selected ? "default" : "outline" }),
                "h-11 min-w-11 px-2 lg:h-9",
              )}
            >
              {Icon ? <Icon aria-hidden="true" /> : target.label}
            </Link>
          );
        })}
      </nav>
      <p className="flex min-h-8 items-center justify-center gap-1.5 text-sm font-semibold tabular-nums lg:justify-end">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {t("reservation.dateNavigation.summary", { date: dateLabel, mode: modeLabel, count })}
      </p>
    </section>
  );
}
