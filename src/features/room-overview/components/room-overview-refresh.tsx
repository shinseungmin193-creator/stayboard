"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RoomOverviewRefresh({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  return <Button type="button" variant="outline" size={compact ? "sm" : "default"} onClick={() => router.refresh()}><RefreshCw />새로고침</Button>;
}
