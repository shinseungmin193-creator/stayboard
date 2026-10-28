"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { updateRoomOperationalStatusAction } from "@/features/rooms/room-operational-status.actions";
import {
  getRoomOperationalStatusLabel,
  ROOM_OPERATIONAL_STATUS_META,
  ROOM_OPERATIONAL_STATUS_VALUES,
} from "@/features/rooms/room-operational-status";
import type { RoomOperationalStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function RoomOverviewOperationalStatusMenu({
  roomId,
  initialStatus,
  canUpdate,
}: {
  roomId: string;
  initialStatus: RoomOperationalStatus;
  canUpdate: boolean;
}) {
  const i18n = useTranslations();
  const router = useRouter();
  const [status, setStatus] = useState<RoomOperationalStatus>(
    initialStatus === "INSPECTION_REQUIRED" ? "NONE" : initialStatus,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const meta = ROOM_OPERATIONAL_STATUS_META[status];
  const label = getRoomOperationalStatusLabel(status, i18n);

  const update = (next: RoomOperationalStatus) => {
    if (pending || next === status) return;
    setError(null);
    startTransition(async () => {
      const result = await updateRoomOperationalStatusAction({ roomId, operationalStatus: next });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setStatus(result.operationalStatus === "INSPECTION_REQUIRED" ? "NONE" : result.operationalStatus);
      router.refresh();
    });
  };

  const indicator = status === "NONE"
    ? <span className="text-muted-foreground">-</span>
    : <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", meta.badgeClassName)}>{label}</Badge>;

  if (!canUpdate) return indicator;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="ghost" size="xs" className="h-7 gap-1 px-1.5" aria-label={`${label} · ${i18n("auto.m0484")}`} />}
      >
        {indicator}
        {pending ? <LoaderCircle className="size-3 animate-spin" /> : <ChevronDown className="size-3 text-muted-foreground" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {ROOM_OPERATIONAL_STATUS_VALUES.filter((item) => item !== "INSPECTION_REQUIRED").map((item) => (
          <DropdownMenuItem key={item} disabled={pending} onClick={() => update(item)}>
            {getRoomOperationalStatusLabel(item, i18n)}
            {item === status && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        {error && (
          <>
            <DropdownMenuSeparator />
            <p role="alert" className="px-2 py-1 text-xs text-destructive">{error}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
