import { useTranslations, useLocale } from "next-intl";import { differenceInCalendarDays } from "date-fns";
import type { RoomOverviewReservation } from "../domain/room-overview";



interface RoomOverviewGuestInfoProps {
  reservation: RoomOverviewReservation;
  guestName: string | null;
  reservationCount: number;
  isNextReservation: boolean;
}

export function RoomOverviewGuestInfo({ reservation, guestName, reservationCount, isNextReservation }: RoomOverviewGuestInfoProps) {const locale = useLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const dateFormatter = new Intl.DateTimeFormat(localeTag, { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });const i18n = useTranslations();
  return <div className="space-y-2.5" data-room-overview-next-reservation={isNextReservation || undefined}>
    {guestName && <div data-room-overview-guest-name>
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground xl:hidden">{i18n("pageEyebrow.guest")}</p>
      <p className="truncate text-sm font-semibold leading-5">{guestName}</p>
    </div>}
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs xl:grid-cols-3 xl:gap-x-2 xl:gap-y-0">
      <div data-room-overview-stay-date><dt className="text-[11px] text-muted-foreground xl:leading-4">{i18n("reservation.checkIn")}</dt><dd className="mt-0.5 font-semibold tabular-nums xl:mt-0 xl:text-sm xl:leading-5">{dateFormatter.format(reservation.startDate)}</dd></div>
      <div data-room-overview-stay-date><dt className="text-[11px] text-muted-foreground xl:leading-4">{i18n("reservation.checkOut")}</dt><dd className="mt-0.5 font-semibold tabular-nums xl:mt-0 xl:text-sm xl:leading-5">{dateFormatter.format(reservation.endDate)}</dd></div>
      <div data-room-overview-night-count><dt className="text-[11px] text-muted-foreground xl:leading-4">{i18n("auto.m0407")}</dt><dd className="mt-0.5 font-semibold tabular-nums xl:mt-0 xl:text-sm xl:leading-5">{i18n("units.nights", { count: differenceInCalendarDays(reservation.endDate, reservation.startDate) })}</dd></div>
      <div className="xl:hidden"><dt className="text-muted-foreground">{i18n("common.reservation")}</dt><dd className="mt-0.5 font-medium">{reservationCount}{i18n("auto.m0013")}</dd></div>
    </dl>
  </div>;
}
