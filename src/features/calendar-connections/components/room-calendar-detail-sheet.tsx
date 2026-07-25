"use client";

import { Cable } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CalendarRoomOption } from "@/features/calendar-sources";
import { CalendarSourceForm } from "@/features/calendar-sources/components/calendar-source-form";
import type { RoomCalendarSummary } from "../types/room-calendar-summary";
import { CalendarSourceCard } from "./calendar-source-card";
import { RoomCalendarStatusBadge } from "./room-calendar-status-badge";
import { RoomCalendarSync } from "./room-calendar-sync";

const formatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" });
const formatDate = (value: Date | null) => value ? formatter.format(new Date(value)) : "-";

export function RoomCalendarDetailSheet({ room, rooms, open, onOpenChange }: { room: RoomCalendarSummary | null; rooms: CalendarRoomOption[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const selectedRoomOptions = room ? rooms.filter((option) => option.id === room.roomId) : [];
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="gap-0" style={{ width: "100%", maxWidth: "64rem" }}>{room && <>
    <SheetHeader className="border-b pr-12"><div className="flex flex-wrap items-center gap-2"><SheetTitle>{room.propertyName} · {room.roomName}</SheetTitle><RoomCalendarStatusBadge status={room.status} /></div><SheetDescription>최신 객실 동기화 실행과 Provider별 결과를 확인합니다.</SheetDescription><div className="flex flex-wrap items-start gap-2 pt-3"><RoomCalendarSync roomIds={[room.roomId]} compact /><CalendarSourceForm rooms={selectedRoomOptions} /></div></SheetHeader>
    <Tabs defaultValue="current" className="min-h-0 flex-1 p-4"><TabsList className="w-full"><TabsTrigger value="current">현재 상태</TabsTrigger><TabsTrigger value="history">최근 동기화 이력</TabsTrigger><TabsTrigger value="sources">연결된 CalendarSource</TabsTrigger></TabsList>
      <TabsContent value="current" className="mt-4 space-y-3 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-sm"><div>대상 <strong className="tabular-nums">{room.latestRun?.targetCount ?? 0}</strong></div><div>성공 <strong className="tabular-nums text-emerald-700">{room.latestRun?.successCount ?? 0}</strong></div><div>실패 <strong className="tabular-nums text-destructive">{room.latestRun?.failedCount ?? 0}</strong></div></div>
        {room.sources.length ? room.sources.map((source) => <CalendarSourceCard key={source.id} source={source} rooms={rooms} showActions={false} />) : <EmptyState icon={Cable} title="연결된 OTA 캘린더가 없습니다" description="이 객실에 새 OTA 연결을 등록해 주세요." />}
      </TabsContent>
      <TabsContent value="history" className="mt-4 overflow-auto"><Table><TableHeader><TableRow><TableHead>시작</TableHead><TableHead>종료</TableHead><TableHead>방식</TableHead><TableHead>결과</TableHead><TableHead>상태</TableHead><TableHead>실행자</TableHead><TableHead>오류 요약</TableHead></TableRow></TableHeader><TableBody>{room.history.map((run) => <TableRow key={run.id}><TableCell className="whitespace-nowrap text-xs">{formatDate(run.startedAt)}</TableCell><TableCell className="whitespace-nowrap text-xs">{formatDate(run.finishedAt)}</TableCell><TableCell>{run.executionMode === "AUTO" ? "자동" : "수동"}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{run.targetCount} / {run.successCount} / {run.failedCount}</TableCell><TableCell><RoomCalendarStatusBadge status={run.status} /></TableCell><TableCell>{run.actorName}</TableCell><TableCell className="max-w-64 text-xs text-destructive">{run.errorSummary ?? "-"}</TableCell></TableRow>)}</TableBody></Table>{!room.history.length && <p className="p-8 text-center text-sm text-muted-foreground">동기화 이력이 없습니다.</p>}</TabsContent>
      <TabsContent value="sources" className="mt-4 space-y-3 overflow-y-auto">{room.sources.length ? room.sources.map((source) => <CalendarSourceCard key={source.id} source={source} rooms={rooms} />) : <EmptyState icon={Cable} title="연결된 OTA 캘린더가 없습니다" description="이 객실에 새 OTA 연결을 등록해 주세요." />}</TabsContent>
    </Tabs>
  </>}</SheetContent></Sheet>;
}
