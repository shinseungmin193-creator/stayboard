"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  companyScopeIds,
  FORBIDDEN_ACTION_RESULT,
  isAccessControlError,
  PERMISSIONS,
  requirePermission,
  requirePropertyAccess,
  requireRoomAccess,
} from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError } from "@/lib/prisma-errors";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getZonedMidnight, shiftDateInput } from "@/lib/zoned-date";
import { getReservationConflictTodayStart, isPastReservationConflict } from "./domain/reservation-conflict-dismissal";
import {
  dismissReservationConflict,
  dismissReservationConflictsInScope,
  findReservationConflictDismissalTarget,
} from "./infrastructure/reservation-conflict-dismissal.repository";
import { reservationConflictBulkDismissSchema, reservationConflictDismissSchema } from "./reservation-conflict.schemas";
import type { ConflictBulkDismissalInput } from "./reservation-conflict.types";

export interface ReservationConflictDismissalResult {
  count: number;
  conflictIds?: string[];
}

function revalidateConflictViews() {
  for (const path of ["/reservation-conflicts", "/reservations", "/room-overview", "/room-status", "/"]) {
    revalidatePath(path);
  }
}

async function conflictActionFailure(error: unknown, context: string): Promise<ActionResult<ReservationConflictDismissalResult>> {
  const t = await getTranslations("conflictCleanup");
  if (isAccessControlError(error)) return { ...FORBIDDEN_ACTION_RESULT, message: t("errors.forbidden") };
  const failure = await actionFailureFromError(error, context);
  return { ...failure, message: t("errors.failed") };
}

export async function dismissReservationConflictAction(
  input: { conflictId: string },
): Promise<ActionResult<ReservationConflictDismissalResult>> {
  const parsed = reservationConflictDismissSchema.safeParse(input);
  const t = await getTranslations("conflictCleanup");
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.invalidRequest") };
  try {
    const target = await findReservationConflictDismissalTarget(parsed.data.conflictId);
    if (!target) return { success: false, status: 404, errorCode: "NOT_FOUND", message: t("errors.notFound") };
    const context = await requireRoomAccess(target.roomId, PERMISSIONS.ROOM_MANAGE);
    if (target.status === "DISMISSED") return { success: true, data: { count: 0, conflictIds: [target.id] }, message: t("alreadyDismissed") };
    const todayStart = getReservationConflictTodayStart();
    if (target.status !== "ACTIVE" || !isPastReservationConflict(target.overlapEnd, todayStart)) {
      return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.notPast") };
    }
    const count = await dismissReservationConflict({ target, todayStart, context });
    if (!count) return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: t("errors.changed") };
    revalidateConflictViews();
    return { success: true, data: { count, conflictIds: [target.id] }, message: t("success") };
  } catch (error) {
    return conflictActionFailure(error, "dismissReservationConflict");
  }
}

export async function dismissPastReservationConflictsAction(
  input: ConflictBulkDismissalInput,
): Promise<ActionResult<ReservationConflictDismissalResult>> {
  const parsed = reservationConflictBulkDismissSchema.safeParse(input);
  const t = await getTranslations("conflictCleanup");
  if (!parsed.success || parsed.data.to < parsed.data.from) {
    return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.invalidRequest") };
  }
  try {
    const context = await requirePermission(PERMISSIONS.ROOM_MANAGE);
    if (parsed.data.propertyId) await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.ROOM_MANAGE);
    if (parsed.data.roomId) await requireRoomAccess(parsed.data.roomId, PERMISSIONS.ROOM_MANAGE);
    const count = await dismissReservationConflictsInScope({
      filters: {
        propertyId: parsed.data.propertyId,
        roomId: parsed.data.roomId,
        provider: parsed.data.provider,
        from: getZonedMidnight(parsed.data.from, DEFAULT_TIMEZONE),
        toExclusive: getZonedMidnight(shiftDateInput(parsed.data.to, 1), DEFAULT_TIMEZONE),
        companyIds: companyScopeIds(context),
        accessScope: context.scope,
      },
      todayStart: getReservationConflictTodayStart(),
      context,
    });
    revalidateConflictViews();
    return { success: true, data: { count }, message: t("bulkSuccess", { count }) };
  } catch (error) {
    return conflictActionFailure(error, "dismissPastReservationConflicts");
  }
}
