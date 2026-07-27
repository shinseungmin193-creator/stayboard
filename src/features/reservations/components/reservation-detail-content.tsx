import { differenceInCalendarDays } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ReservationViewModel } from "../reservation-view-model";
import { getReservationDisplayName } from "../reservation-display";
import { getProviderVisual } from "../provider-visuals";
import { getReservationSyncStatusLabel } from "../reservation-status-meta";
import { ReservationStatusBadge } from "./reservation-status-badge";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function DetailItem({ label, value, wide = false, mono = false }: { label: string; value?: string | null; wide?: boolean; mono?: boolean }) {
  if (!value?.trim()) return null;
  return <div className={cn("min-w-0 rounded-lg border bg-muted/25 px-3 py-2.5", wide && "col-span-2")}><dt className="text-[10px] font-medium text-muted-foreground">{label}</dt><dd className={cn("mt-1 break-words text-sm font-medium", mono && "font-mono text-xs")}>{value}</dd></div>;
}

export function ReservationDetailContent({ reservation }: { reservation: ReservationViewModel }) {
  const provider = getProviderVisual(reservation.provider);
  const nights = Math.max(1, differenceInCalendarDays(new Date(reservation.endDate), new Date(reservation.startDate)));
  const syncHasError = reservation.latestSyncStatus === "FAILED" || reservation.latestSyncStatus === "TIMEOUT";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ReservationStatusBadge status={reservation.displayStatus} />
        <Badge variant="outline" className={provider.className}>{provider.label}</Badge>
        {reservation.activeConflictCount > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle />겹치는 예약 {reservation.activeConflictCount}건</Badge>}
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <DetailItem label="체크인" value={dateFormatter.format(new Date(reservation.startDate))} />
        <DetailItem label="체크아웃" value={dateFormatter.format(new Date(reservation.endDate))} />
        <DetailItem label="숙박" value={`${nights}박`} />
        <DetailItem label="예약자" value={getReservationDisplayName(reservation)} />
        <DetailItem label="숙소" value={reservation.propertyName} wide />
        <DetailItem label="객실" value={reservation.roomName} />
        <DetailItem label="캘린더" value={reservation.calendarSourceName} />
        <DetailItem label="OTA 예약 번호" value={reservation.providerReservationId} wide mono />
        <DetailItem label="예약 제목" value={reservation.summary} wide />
        <DetailItem label="메모" value={reservation.description} wide />
      </dl>

      {reservation.latestSyncStatus && (
        <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs", syncHasError ? "border-destructive/40 bg-destructive/5 text-destructive" : "bg-muted/25 text-muted-foreground")}>
          {syncHasError ? <Clock3 className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          <p><strong className="font-semibold text-foreground">동기화 {getReservationSyncStatusLabel(reservation.latestSyncStatus)}</strong>{reservation.latestSyncCompletedAt && <> · {dateTimeFormatter.format(new Date(reservation.latestSyncCompletedAt))}</>}</p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 text-xs">
        {reservation.providerCreatedAt && <div><dt className="text-muted-foreground">OTA 생성</dt><dd className="mt-1">{dateTimeFormatter.format(new Date(reservation.providerCreatedAt))}</dd></div>}
        {reservation.providerUpdatedAt && <div><dt className="text-muted-foreground">OTA 수정</dt><dd className="mt-1">{dateTimeFormatter.format(new Date(reservation.providerUpdatedAt))}</dd></div>}
        <div><dt className="text-muted-foreground">StayBoard 등록</dt><dd className="mt-1">{dateTimeFormatter.format(new Date(reservation.createdAt))}</dd></div>
        <div><dt className="text-muted-foreground">StayBoard 수정</dt><dd className="mt-1">{dateTimeFormatter.format(new Date(reservation.updatedAt))}</dd></div>
      </dl>

      {reservation.activeConflicts.length > 0 && (
        <section className="space-y-2" aria-labelledby="reservation-conflicts-heading">
          <h3 id="reservation-conflicts-heading" className="text-xs font-semibold">겹치는 예약</h3>
          {reservation.activeConflicts.map((conflict) => (
            <div key={conflict.id} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
              <p className="font-semibold">{conflict.guestName?.trim() || "예약자 정보 없음"} · {getProviderVisual(conflict.provider).label}</p>
              <p className="mt-1 text-muted-foreground">{dateFormatter.format(new Date(conflict.startDate))} → {dateFormatter.format(new Date(conflict.endDate))}</p>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
