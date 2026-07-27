"use server";

import { getCurrentAccessContext, getRolePreviewWriteBlock } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { logServerError } from "@/lib/prisma-errors";
import { normalizeSidebarPreference, type SidebarPreferenceValue } from "./domain/sidebar-preference";
import { upsertSidebarPreference } from "./infrastructure/sidebar-preference.repository";
import { sidebarPreferenceInputSchema } from "./sidebar-preference.schemas";

export async function updateSidebarPreferenceAction(input: unknown): Promise<ActionResult<SidebarPreferenceValue>> {
  const context = await getCurrentAccessContext();
  if (!context) return { success: false, message: "사이드바 설정을 저장할 권한이 없습니다." };
  const previewBlock = getRolePreviewWriteBlock(context);
  if (previewBlock) return previewBlock;
  const parsed = sidebarPreferenceInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "사이드바 설정 형식이 올바르지 않습니다." };
  try {
    const preference = await upsertSidebarPreference(context.userId, normalizeSidebarPreference(parsed.data));
    return { success: true, data: preference };
  } catch (error) {
    logServerError("updateSidebarPreference", error);
    return { success: false, message: "사이드바 설정을 저장하지 못했습니다." };
  }
}
