"use client";import { useTranslations } from "next-intl";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { syncRoomOverviewCalendarSourcesAction } from "@/features/calendar-sync/calendar-sync.actions";
import { cn } from "@/lib/utils";

export function RoomOverviewSync({ propertyId, compact = false }: {propertyId?: string;compact?: boolean;}) {const i18n = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{success: boolean;message: string;} | null>(null);

  const synchronize = () => {
    if (pending) return;
    setNotice(null);
    startTransition(async () => {
      const result = await syncRoomOverviewCalendarSourcesAction({ propertyId });
      if (!result.success) {
        setNotice({ success: false, message: result.message });
        return;
      }
      const data = result.data;
      const applied = (data?.createdReservations ?? 0) + (data?.updatedReservations ?? 0);
      setNotice({
        success: true,
        message: data?.totalSources ? i18n("auto.m0486", { value0:
          data.successCount, value1: data.warningCount, value2: data.failureCount, value3: applied }) : i18n("auto.m0487")

      });
      router.refresh();
    });
  };

  return <>
    <Button type="button" variant="outline" size={compact ? "sm" : "default"} disabled={pending} onClick={synchronize} aria-label={pending ? i18n("auto.m0488") : i18n("auto.m0489")}>
      <RefreshCw className={cn(pending && "animate-spin")} />
      <span className="hidden sm:inline">{pending ? i18n("auto.m0490") : i18n("auto.m0491")}</span>
      <span className="sm:hidden">{pending ? i18n("auto.m0490") : i18n("common.sync")}</span>
    </Button>
    {notice && <div role={notice.success ? "status" : "alert"} aria-live="polite" className={cn("fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2rem)] rounded-lg border bg-card px-4 py-3 text-sm shadow-lg", notice.success ? "border-emerald-500/40" : "border-destructive/40 text-destructive")}>{notice.message}</div>}
  </>;
}
