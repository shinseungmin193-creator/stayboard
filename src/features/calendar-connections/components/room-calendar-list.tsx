"use client";

import { useMemo, useState } from "react";
import { Cable } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import type { RoomCalendarSummary } from "../types/room-calendar-summary";
import { RoomCalendarDetailSheet } from "./room-calendar-detail-sheet";
import { RoomCalendarRow } from "./room-calendar-row";
import { RESERVATION_CONFLICT_UI } from "@/features/reservation-conflicts/reservation-conflict.labels";

export function RoomCalendarList({ summaries, rooms }: { summaries: RoomCalendarSummary[]; rooms: CalendarRoomOption[] }) {
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedRoom = useMemo(() => summaries.find((room) => room.roomId === selectedRoomId) ?? null, [selectedRoomId, summaries]);
  const handleOpen = (roomId: string) => setSelectedRoomId(roomId);
  const handleOpenChange = (open: boolean) => { if (!open) setSelectedRoomId(null); };

  if (!summaries.length) return <Card><CardContent className="flex min-h-72 items-center"><EmptyState icon={Cable} title="표시할 객실이 없습니다" description="필터를 변경하거나 객실에 캘린더 연결을 등록해 주세요." /></CardContent></Card>;

  return <>
    <div className="grid gap-3 lg:hidden">{summaries.map((room) => <RoomCalendarRow key={room.roomId} room={room} onOpen={handleOpen} mobile />)}</div>
    <Card className="hidden py-0 lg:block">
      <Table>
        <TableHeader><TableRow><TableHead>숙소 / 객실</TableHead><TableHead>Provider</TableHead><TableHead>연결</TableHead><TableHead className="text-center">예약</TableHead><TableHead className="text-center">{RESERVATION_CONFLICT_UI.label}</TableHead><TableHead>최근 동기화</TableHead><TableHead>통합 상태</TableHead><TableHead className="text-right">관리</TableHead></TableRow></TableHeader>
        <TableBody>{summaries.map((room) => <RoomCalendarRow key={room.roomId} room={room} onOpen={handleOpen} />)}</TableBody>
      </Table>
    </Card>
    <RoomCalendarDetailSheet room={selectedRoom} rooms={rooms} open={Boolean(selectedRoom)} onOpenChange={handleOpenChange} />
  </>;
}
