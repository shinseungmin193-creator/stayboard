"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getCurrentUser } from "@/features/auth/server/get-current-user";
import type { ActionResult } from "@/lib/action-result";
import { developerRoleSwitchInputSchema } from "./developer-role-switch.schemas";
import type { ActiveDeveloperRoleSwitch } from "./domain/developer-role-switch.types";
import {
  DeveloperRoleSwitchError,
  revokeDeveloperRoleSessionByToken,
  startDeveloperRoleSession,
  updateDeveloperRoleSession,
} from "./server/developer-role-switch.service";
import {
  clearDeveloperRoleSwitchCookie,
  getDeveloperRoleSwitchCookieToken,
  setDeveloperRoleSwitchCookie,
} from "./server/developer-role-switch.session";

export type DeveloperRoleSwitchActionResult = ActionResult<ActiveDeveloperRoleSwitch & { redirectPath: string }>;

async function actionError(error: unknown): Promise<DeveloperRoleSwitchActionResult> {
  const t = await getTranslations("developerRoleSwitch.messages");
  const code = error instanceof DeveloperRoleSwitchError ? error.code : "UNKNOWN";
  const key = code === "UNAUTHENTICATED"
    ? "unauthenticated"
    : code === "FORBIDDEN"
      ? "forbidden"
      : code === "DISABLED"
        ? "disabled"
        : code === "COMPANY_UNAVAILABLE"
          ? "companyUnavailable"
          : code === "PROPERTY_REQUIRED"
            ? "propertyRequired"
            : code === "PROPERTY_OUT_OF_SCOPE"
              ? "propertyOutOfScope"
              : code === "SESSION_EXPIRED"
                ? "sessionExpired"
                : code === "SESSION_UNAVAILABLE"
                  ? "sessionUnavailable"
                  : code === "INVALID_INPUT"
                    ? "invalidInput"
                    : "failed";
  const validationCodes = new Set(["INVALID_INPUT", "COMPANY_UNAVAILABLE", "PROPERTY_REQUIRED", "PROPERTY_OUT_OF_SCOPE"]);
  return {
    success: false,
    status: code === "UNAUTHENTICATED" ? 401 : code === "UNKNOWN" ? 500 : code === "SESSION_UNAVAILABLE" ? 404 : validationCodes.has(code) ? 400 : 403,
    errorCode: code === "UNAUTHENTICATED"
      ? "UNAUTHORIZED"
      : code === "SESSION_UNAVAILABLE"
        ? "NOT_FOUND"
        : validationCodes.has(code)
          ? "VALIDATION_ERROR"
          : code === "UNKNOWN"
            ? "UNKNOWN_ERROR"
            : "FORBIDDEN",
    message: t(key),
  };
}

function redirectPath(role: "ADMIN" | "STAFF") {
  return role === "ADMIN" ? "/settings/admin" : "/room-overview";
}

export async function startDeveloperRoleSessionAction(input: unknown): Promise<DeveloperRoleSwitchActionResult> {
  const parsed = developerRoleSwitchInputSchema.safeParse(input);
  if (!parsed.success) return actionError(new DeveloperRoleSwitchError("INVALID_INPUT"));
  try {
    const result = await startDeveloperRoleSession(await getCurrentUser(), parsed.data, await getDeveloperRoleSwitchCookieToken());
    await setDeveloperRoleSwitchCookie(result.token, new Date(result.active.expiresAt));
    revalidatePath("/", "layout");
    return { success: true, message: (await getTranslations("developerRoleSwitch.messages"))("started"), data: { ...result.active, redirectPath: redirectPath(result.active.previewRole) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateDeveloperRoleSessionAction(input: unknown): Promise<DeveloperRoleSwitchActionResult> {
  const parsed = developerRoleSwitchInputSchema.safeParse(input);
  if (!parsed.success) return actionError(new DeveloperRoleSwitchError("INVALID_INPUT"));
  try {
    const result = await updateDeveloperRoleSession(await getCurrentUser(), parsed.data, await getDeveloperRoleSwitchCookieToken());
    await setDeveloperRoleSwitchCookie(result.token, new Date(result.active.expiresAt));
    revalidatePath("/", "layout");
    return { success: true, message: (await getTranslations("developerRoleSwitch.messages"))("updated"), data: { ...result.active, redirectPath: redirectPath(result.active.previewRole) } };
  } catch (error) {
    return actionError(error);
  }
}

export async function endDeveloperRoleSessionAction(): Promise<ActionResult<{ redirectPath: string }>> {
  const token = await getDeveloperRoleSwitchCookieToken();
  try {
    await revokeDeveloperRoleSessionByToken(token, "MANUAL_RETURN");
    await clearDeveloperRoleSwitchCookie();
    revalidatePath("/", "layout");
    return { success: true, message: (await getTranslations("developerRoleSwitch.messages"))("ended"), data: { redirectPath: "/" } };
  } catch {
    return { success: false, message: (await getTranslations("developerRoleSwitch.messages"))("failed") };
  }
}

export async function cleanupDeveloperRoleSessionForLogoutAction(): Promise<void> {
  const token = await getDeveloperRoleSwitchCookieToken();
  await revokeDeveloperRoleSessionByToken(token, "LOGOUT");
  await clearDeveloperRoleSwitchCookie();
}

export async function clearStaleDeveloperRoleSessionCookieAction(): Promise<void> {
  await clearDeveloperRoleSwitchCookie();
}
