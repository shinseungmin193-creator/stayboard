"use client";import { useTranslations } from "next-intl";

import Link from "next/link";
import { CalendarDays, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ReservationViewModel } from "../reservation-view-model";
import { ReservationDetailContent } from "./reservation-detail-content";
import type { ReservationDisplayStatus } from "../reservation-display-status";

export function ReservationDetailSheet({ reservation, open, onOpenChange, contextualStatus }: {reservation: ReservationViewModel | null;open: boolean;onOpenChange: (open: boolean) => void;contextualStatus?: {status: ReservationDisplayStatus;label: string;};}) {const i18n = useTranslations();
  if (!reservation) return null;
  const date = reservation.startDate.slice(0, 10);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[88dvh] max-h-[88dvh] gap-0 overflow-hidden p-0 md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-dvh md:w-[30rem] md:rounded-none md:border-t-0 md:border-l"
        aria-label={i18n("auto.m0418")}>
        
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30 md:hidden" aria-hidden="true" />
        <SheetHeader className="border-b px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-lg font-bold">{reservation.roomName}</SheetTitle>
          <SheetDescription>{reservation.propertyName}{i18n("auto.m0419")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ReservationDetailContent reservation={reservation} contextualStatus={contextualStatus} />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t bg-popover px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button nativeButton={false} render={<Link href={`/reservations?roomId=${reservation.roomId}`} onClick={() => onOpenChange(false)} />} variant="outline" className="min-h-11"><List />{i18n("auto.m0420")}</Button>
          <Button nativeButton={false} render={<Link href={`/room-overview?view=calendar&propertyId=${reservation.propertyId}&date=${date}`} />} variant="outline" className="min-h-11"><CalendarDays />{i18n("auto.m0421")}</Button>
        </div>
      </SheetContent>
    </Sheet>);

}
