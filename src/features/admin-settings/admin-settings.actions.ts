"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentAccessContext } from "@/features/access-control";
import { logServerError } from "@/lib/prisma-errors";
import { CompanySettingsAccessError, updateCompanySettingsForAccess } from "./application/update-company-settings";
import { companySettingsInputSchema } from "./domain/company-settings";
import { companyExistsForSettings, upsertCompanySettings } from "./infrastructure/company-settings.repository";

const checked = (formData: FormData, name: string) => formData.get(name) === "on";

export async function updateCompanySettingsAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = companySettingsInputSchema.safeParse({
    companyId: formData.get("companyId"),
    timezone: formData.get("timezone"),
    defaultCheckInTime: formData.get("defaultCheckInTime"),
    defaultCheckOutTime: formData.get("defaultCheckOutTime"),
    nextReservationDisplayDays: formData.get("nextReservationDisplayDays"),
    showFutureReservationsAsVacant: checked(formData, "showFutureReservationsAsVacant"),
    showBlockedAsRoomStatus: checked(formData, "showBlockedAsRoomStatus"),
    conflictDisplayLabel: formData.get("conflictDisplayLabel"),
    guestFallbackMode: formData.get("guestFallbackMode"),
    showNextReservationOnVacant: checked(formData, "showNextReservationOnVacant"),
    cleaningStatusEnabled: checked(formData, "cleaningStatusEnabled"),
    inspectionStatusEnabled: checked(formData, "inspectionStatusEnabled"),
    autoMarkCleaningRequired: checked(formData, "autoMarkCleaningRequired"),
    showSyncFailureWarnings: checked(formData, "showSyncFailureWarnings"),
    showSyncSuccessMessage: checked(formData, "showSyncSuccessMessage"),
    recentSyncLogLimit: formData.get("recentSyncLogLimit"),
  });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const context = await getCurrentAccessContext();
  if (!context) return { success: false, message: "이 작업을 수행할 권한이 없습니다." };
  try {
    await updateCompanySettingsForAccess(context, parsed.data, {
      companyExists: companyExistsForSettings,
      upsert: upsertCompanySettings,
    });
    revalidatePath("/settings/admin");
    revalidatePath("/room-overview");
    return { success: true, message: "관리자 설정을 저장했습니다." };
  } catch (error) {
    if (error instanceof CompanySettingsAccessError) return { success: false, message: error.message };
    logServerError("updateCompanySettings", error);
    return { success: false, message: "관리자 설정을 저장하지 못했습니다." };
  }
}
