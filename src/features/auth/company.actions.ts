"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { AUTH_COOKIE_PATH, USE_SECURE_AUTH_COOKIES } from "./domain/cookie-policy";
import { getCurrentUser } from "./server/get-current-user";

const ACTIVE_COMPANY_COOKIE = "stayboard.active-company";
const schema = z.object({ companyId: z.string().trim().max(100) });

export async function switchActiveCompanyAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  const user = await getCurrentUser();
  if (!parsed.success || !user?.isActive) return { success: false, message: "회사를 전환할 권한이 없습니다." };
  if (!parsed.data.companyId) {
    if (user.systemRole !== "DEVELOPER") return { success: false, message: "회사를 선택해 주세요." };
    (await cookies()).set(ACTIVE_COMPANY_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: USE_SECURE_AUTH_COOKIES,
      path: AUTH_COOKIE_PATH,
      expires: new Date(0),
      maxAge: 0,
    });
    return { success: true, message: "전체 회사 범위로 전환했습니다." };
  }
  const allowed = user.systemRole === "DEVELOPER"
    ? await prisma.company.findFirst({ where: { id: parsed.data.companyId, isActive: true }, select: { id: true } })
    : user.memberships.find((membership) => membership.companyId === parsed.data.companyId);
  if (!allowed) return { success: false, message: "회사를 전환할 권한이 없습니다." };
  (await cookies()).set(ACTIVE_COMPANY_COOKIE, parsed.data.companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: USE_SECURE_AUTH_COOKIES,
    path: AUTH_COOKIE_PATH,
    maxAge: 60 * 60 * 24 * 30,
  });
  return { success: true, message: "회사를 전환했습니다." };
}
