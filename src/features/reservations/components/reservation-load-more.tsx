"use client";

import { LoaderCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESERVATION_PAGE_SIZE } from "../reservation.constants";

export function ReservationLoadMore({ remainingCount, loading, error, onLoadMore }: { remainingCount: number; loading: boolean; error: string | null; onLoadMore: () => void }) {
  if (remainingCount <= 0) return null;
  return (
    <div className="space-y-2 text-center">
      <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto sm:min-w-56" disabled={loading} onClick={onLoadMore}>
        {loading ? <LoaderCircle className="animate-spin" /> : <Plus />}{loading ? "불러오는 중" : `예약 ${Math.min(remainingCount, RESERVATION_PAGE_SIZE)}건 더 보기`}
      </Button>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}
