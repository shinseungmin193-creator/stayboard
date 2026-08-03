"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import type { ActionResult } from "@/lib/action-result";
import { logServerError } from "@/lib/prisma-errors";
import type { MobileNavigationPreferenceValue } from "./domain/mobile-navigation-preference";
import {
  MobileNavigationPreferenceError,
  resetStaffMobileNavigationPreference,
  saveStaffMobileNavigationPreference,
} from "./server/mobile-navigation-preference.service";
import {
  mobileNavigationPreferenceInputSchema,
  mobileNavigationPreferenceResetSchema,
} from "./mobile-navigation-preference.schemas";

async function failure(error: unknown): Promise<ActionResult<MobileNavigationPreferenceValue>> {
  const t = await getTranslations("mobileNavigationPreferences.messages");
  if (error instanceof MobileNavigationPreferenceError) {
    const key = error.code === "UNAUTHENTICATED"
      ? "unauthenticated"
      : error.code === "FORBIDDEN"
        ? "forbidden"
        : error.code === "COMPANY_UNAVAILABLE"
          ? "companyUnavailable"
          : "invalidInput";
    return { success: false, status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400, message: t(key) };
  }
  logServerError("mobileNavigationPreferenceAction", error);
  return { success: false, status: 500, message: t("failed") };
}

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/developer/settings");
  revalidatePath("/developer/audit-logs");
}

export async function saveStaffMobileNavigationPreferenceAction(input: unknown): Promise<ActionResult<MobileNavigationPreferenceValue>> {
  const parsed = mobileNavigationPreferenceInputSchema.safeParse(input);
  if (!parsed.success) return failure(new MobileNavigationPreferenceError("INVALID_INPUT"));
  try {
    const data = await saveStaffMobileNavigationPreference(parsed.data.companyId, { itemOrder: parsed.data.itemOrder });
    refresh();
    return { success: true, data, message: (await getTranslations("mobileNavigationPreferences.messages"))("saved") };
  } catch (error) {
    return failure(error);
  }
}

export async function resetStaffMobileNavigationPreferenceAction(input: unknown): Promise<ActionResult<MobileNavigationPreferenceValue>> {
  const parsed = mobileNavigationPreferenceResetSchema.safeParse(input);
  if (!parsed.success) return failure(new MobileNavigationPreferenceError("INVALID_INPUT"));
  try {
    const data = await resetStaffMobileNavigationPreference(parsed.data.companyId);
    refresh();
    return { success: true, data, message: (await getTranslations("mobileNavigationPreferences.messages"))("reset") };
  } catch (error) {
    return failure(error);
  }
}
