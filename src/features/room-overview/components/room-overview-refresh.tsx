"use client";import { useTranslations } from "next-intl";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RoomOverviewRefresh({ compact = false }: {compact?: boolean;}) {const i18n = useTranslations();
  const router = useRouter();
  return <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={() => router.refresh()}><RefreshCw />{i18n("auto.m0477")}</Button>;
}
