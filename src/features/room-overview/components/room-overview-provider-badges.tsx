import { useTranslations } from "next-intl";import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import styles from "./room-overview-visuals.module.css";

interface RoomOverviewProviderBadgesProps {
  providers: CalendarProviderType[];
  currentProvider: CalendarProviderType | null;
  className?: string;
}

export function RoomOverviewProviderBadges({ providers, currentProvider, className }: RoomOverviewProviderBadgesProps) {const i18n = useTranslations();
  if (!providers.length) return null;

  return <div data-room-overview-providers className={cn("ml-auto flex max-w-full shrink-0 flex-wrap content-start justify-end gap-1", className)}>
    {providers.map((provider) => {
      const providerLabel = getProviderLabel(provider, i18n);
      const isCurrentProvider = provider === currentProvider;

      return <Badge
        key={provider}
        variant="outline"
        className={cn("rounded-full border-border/70 bg-background/60 font-medium tracking-wide text-foreground data-[current-provider=true]:border-foreground/35 data-[current-provider=true]:bg-background/90", styles.providerBadge)}
        aria-label={isCurrentProvider ? i18n("auto.m0476", { value0: providerLabel }) : providerLabel}
        data-room-overview-provider-badge
        data-current-provider={isCurrentProvider || undefined}>
        
        {providerLabel}
      </Badge>;
    })}
  </div>;
}
