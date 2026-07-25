"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/lib/action-result";
import { signupSchema } from "./auth.schemas";
import { hashPassword } from "./server/password";

export async function signupAction(formData: FormData): Promise<ActionResult<{ email: string }>> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    companyName: formData.get("companyName"),
  });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };

  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, passwordHash } });
      const company = await tx.company.create({ data: { name: parsed.data.companyName } });
      await tx.companyMembership.create({ data: { userId: user.id, companyId: company.id, role: "ADMIN" } });
      await tx.auditLog.create({ data: { actorUserId: user.id, targetUserId: user.id, action: "PUBLIC_SIGNUP", details: { companyId: company.id } } });
    });
    return { success: true, message: "계정과 회사가 생성되었습니다.", data: { email: parsed.data.email } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false, message: "이미 사용 중인 이메일입니다.", fieldErrors: { email: ["이미 사용 중인 이메일입니다."] } };
    }
    if (process.env.NODE_ENV === "development") console.error("[signup]", error instanceof Error ? error.name : "UnknownError");
    return { success: false, message: "회원가입을 완료하지 못했습니다." };
  }
}
