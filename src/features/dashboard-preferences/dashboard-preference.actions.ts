"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/lib/action-result";
import { logServerError } from "@/lib/prisma-errors";
import type { DashboardPreferenceValue } from "./domain/dashboard-preference";
import {
  DashboardPreferenceError,
  resetStaffMobileDashboardPreference,
  saveStaffMobileDashboardPreference,
} from "./server/dashboard-preference.service";
import {
  dashboardPreferenceInputSchema,
  dashboardPreferenceResetSchema,
} from "./dashboard-preference.schemas";

async function failure(error: unknown): Promise<ActionResult<DashboardPreferenceValue>> {
  const t = await getTranslations("dashboardPreferences.messages");
  if (error instanceof DashboardPreferenceError) {
    const key = error.code === "UNAUTHENTICATED"
      ? "unauthenticated"
      : error.code === "FORBIDDEN"
        ? "forbidden"
        : error.code === "COMPANY_UNAVAILABLE"
          ? "companyUnavailable"
          : "invalidInput";
    return { success: false, status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400, message: t(key) };
  }
  logServerError("dashboardPreferenceAction", error);
  return { success: false, status: 500, message: t("failed") };
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/developer/settings");
  revalidatePath("/developer/audit-logs");
}

export async function saveStaffMobileDashboardPreferenceAction(input: unknown): Promise<ActionResult<DashboardPreferenceValue>> {
  const parsed = dashboardPreferenceInputSchema.safeParse(input);
  if (!parsed.success) return failure(new DashboardPreferenceError("INVALID_INPUT"));
  try {
    const data = await saveStaffMobileDashboardPreference(parsed.data.companyId, {
      cardOrder: parsed.data.cardOrder,
      hiddenCardIds: parsed.data.hiddenCardIds,
    });
    refresh();
    return { success: true, data, message: (await getTranslations("dashboardPreferences.messages"))("saved") };
  } catch (error) {
    return failure(error);
  }
}

export async function resetStaffMobileDashboardPreferenceAction(input: unknown): Promise<ActionResult<DashboardPreferenceValue>> {
  const parsed = dashboardPreferenceResetSchema.safeParse(input);
  if (!parsed.success) return failure(new DashboardPreferenceError("INVALID_INPUT"));
  try {
    const data = await resetStaffMobileDashboardPreference(parsed.data.companyId);
    refresh();
    return { success: true, data, message: (await getTranslations("dashboardPreferences.messages"))("reset") };
  } catch (error) {
    return failure(error);
  }
}
