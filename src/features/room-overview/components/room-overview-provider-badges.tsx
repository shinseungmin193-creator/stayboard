import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import styles from "./room-overview-visuals.module.css";
import { getCalendarProviderLabel } from "@/providers/calendar/types";

interface RoomOverviewProviderBadgesProps {
  providers: CalendarProviderType[];
  currentProvider: CalendarProviderType | null;
  className?: string;
}

export function RoomOverviewProviderBadges({ providers, currentProvider, className }: RoomOverviewProviderBadgesProps) {
  if (!providers.length) return null;

  return <div data-room-overview-providers className={cn("ml-auto flex max-w-full shrink-0 flex-wrap content-start justify-end gap-1", className)}>
    {providers.map((provider) => {
      const providerLabel = getCalendarProviderLabel(provider);
      if (!providerLabel) return null;
      const isCurrentProvider = provider === currentProvider;

      return <Badge
        key={provider}
        variant="outline"
        className={cn("h-5 rounded-full px-2 text-[10px] font-medium tracking-wide", styles.providerBadge)}
        aria-label={isCurrentProvider ? `${providerLabel} · 현재 예약 Provider` : providerLabel}
        data-current-provider={isCurrentProvider || undefined}
      >
        {providerLabel}
      </Badge>;
    })}
  </div>;
}
