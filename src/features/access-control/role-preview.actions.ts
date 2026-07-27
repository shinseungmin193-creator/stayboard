"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { AUTH_COOKIE_PATH } from "@/features/auth/domain/cookie-policy";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentAccessContext } from "./application/access-context";
import { isUserRole } from "./domain/access-control";
import { canUseRolePreview, ROLE_PREVIEW_COOKIE_NAME, ROLE_PREVIEW_MAX_AGE_SECONDS } from "./domain/role-preview";

export type RolePreviewActionResult = ActionResult;

const unavailable = (): RolePreviewActionResult => ({
  success: false,
  status: 403,
  errorCode: "FORBIDDEN",
  message: "현재 환경에서는 권한 미리보기를 사용할 수 없습니다.",
});

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: AUTH_COOKIE_PATH,
    maxAge,
  };
}

async function rolePreviewContext() {
  const context = await getCurrentAccessContext();
  if (!context || !canUseRolePreview(process.env, context.actualRole)) return null;
  return context;
}

export async function setRolePreviewAction(_state: RolePreviewActionResult, formData: FormData): Promise<RolePreviewActionResult> {
  const requestedRole = formData.get("previewRole");
  if (!isUserRole(requestedRole)) return { success: false, message: "미리보기 권한을 확인해 주세요." };
  const context = await rolePreviewContext();
  if (!context) return unavailable();
  if (requestedRole !== "DEVELOPER" && !context.activeCompanyId) {
    return { success: false, message: "관리자 또는 직원 미리보기 전에 회사를 선택해 주세요." };
  }

  const cookieStore = await cookies();
  if (requestedRole === "DEVELOPER") {
    cookieStore.set(ROLE_PREVIEW_COOKIE_NAME, "", cookieOptions(0));
  } else {
    cookieStore.set(ROLE_PREVIEW_COOKIE_NAME, requestedRole, cookieOptions(ROLE_PREVIEW_MAX_AGE_SECONDS));
  }
  revalidatePath("/", "layout");
  return { success: true, message: `${requestedRole === "DEVELOPER" ? "개발자" : requestedRole === "ADMIN" ? "관리자" : "직원"} 권한으로 전환했습니다.` };
}

export async function endRolePreviewAction(): Promise<ActionResult> {
  const context = await rolePreviewContext();
  if (!context) return unavailable();
  (await cookies()).set(ROLE_PREVIEW_COOKIE_NAME, "", cookieOptions(0));
  revalidatePath("/", "layout");
  return { success: true, message: "개발자 권한으로 복귀했습니다." };
}
