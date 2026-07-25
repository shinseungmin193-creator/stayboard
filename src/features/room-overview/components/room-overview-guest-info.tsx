import { differenceInCalendarDays } from "date-fns";
import type { RoomOverviewReservation } from "../domain/room-overview";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Tokyo" });

interface RoomOverviewGuestInfoProps {
  reservation: RoomOverviewReservation;
  guestName: string | null;
  reservationCount: number;
  isNextReservation: boolean;
}

export function RoomOverviewGuestInfo({ reservation, guestName, reservationCount, isNextReservation }: RoomOverviewGuestInfoProps) {
  return <div className="space-y-2.5" data-room-overview-next-reservation={isNextReservation || undefined}>
    {guestName && <div data-room-overview-guest-name>
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground xl:hidden">GUEST</p>
      <p className="truncate text-sm font-semibold leading-5">{guestName}</p>
    </div>}
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs xl:grid-cols-3 xl:gap-x-2 xl:gap-y-0">
      <div data-room-overview-stay-date><dt className="text-[11px] text-muted-foreground xl:leading-4">체크인</dt><dd className="mt-0.5 font-semibold tabular-nums xl:mt-0 xl:text-sm xl:leading-5">{dateFormatter.format(reservation.startDate)}</dd></div>
      <div data-room-overview-stay-date><dt className="text-[11px] text-muted-foreground xl:leading-4">체크아웃</dt><dd className="mt-0.5 font-semibold tabular-nums xl:mt-0 xl:text-sm xl:leading-5">{dateFormatter.format(reservation.endDate)}</dd></div>
      <div data-room-overview-night-count><dt className="text-[11px] text-muted-foreground xl:leading-4">숙박</dt><dd className="mt-0.5 font-semibold tabular-nums xl:mt-0 xl:text-sm xl:leading-5">{differenceInCalendarDays(reservation.endDate, reservation.startDate)}박</dd></div>
      <div className="xl:hidden"><dt className="text-muted-foreground">예약</dt><dd className="mt-0.5 font-medium">{reservationCount}건</dd></div>
    </dl>
  </div>;
}
