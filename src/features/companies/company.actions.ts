"use server";
import { revalidatePath } from "next/cache";
import { authorizeAccess, FORBIDDEN_ACTION_RESULT, getRolePreviewWriteBlock, PERMISSIONS } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError, logServerError } from "@/lib/prisma-errors";
import { createCompany, findCompany, updateCompany } from "./company.repository";
import { companyActiveSchema, companyInputSchema, companyUpdateSchema } from "./company.schemas";
import { prisma } from "@/lib/prisma";

export async function createCompanyAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const access = await authorizeAccess(PERMISSIONS.COMPANY_MANAGE);
  if (!access.allowed) return getRolePreviewWriteBlock(access.context) ?? FORBIDDEN_ACTION_RESULT;
  const parsed = companyInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  try { await createCompany(parsed.data.name); revalidatePath("/properties"); return { success: true, message: "회사를 등록했습니다." }; }
  catch (error) { return actionFailureFromError(error, "createCompany"); }
}

export async function updateCompanyAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = companyUpdateSchema.safeParse({ id: formData.get("id"), name: formData.get("name") });
  if (!parsed.success) return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  const access = await authorizeAccess(PERMISSIONS.COMPANY_MANAGE, parsed.data.id);
  if (!access.allowed) return getRolePreviewWriteBlock(access.context) ?? FORBIDDEN_ACTION_RESULT;
  try { await updateCompany(parsed.data.id, parsed.data.name); revalidatePath("/properties"); revalidatePath("/rooms"); return { success: true, message: "회사 정보를 수정했습니다." }; }
  catch (error) { logServerError("updateCompany", error); return { success: false, message: "회사 정보를 수정하지 못했습니다." }; }
}

export async function setCompanyActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = companyActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
  if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  const access = await authorizeAccess(PERMISSIONS.COMPANY_MANAGE, parsed.data.id);
  if (!access.allowed) return getRolePreviewWriteBlock(access.context) ?? FORBIDDEN_ACTION_RESULT;
  try { const current = await findCompany(parsed.data.id); if (!current) return { success: false, message: "회사를 찾을 수 없습니다." }; if (current.isActive === parsed.data.isActive) return { success: true, message: "이미 요청한 상태입니다." }; const reason = "숙소 관리 화면에서 회사 상태 변경"; await prisma.$transaction([prisma.company.update({ where: { id: parsed.data.id }, data: parsed.data.isActive ? { isActive: true, suspendedAt: null, suspendedById: null, suspensionReason: null } : { isActive: false, suspendedAt: new Date(), suspendedById: access.context.userId, suspensionReason: reason } }), prisma.auditLog.create({ data: { actorUserId: access.context.userId, targetCompanyId: parsed.data.id, action: parsed.data.isActive ? "COMPANY_RESTORED" : "COMPANY_SUSPENDED", reason, details: { before: { isActive: current.isActive }, after: { isActive: parsed.data.isActive } } } })]); revalidatePath("/properties"); revalidatePath("/developer/companies"); return { success: true, message: parsed.data.isActive ? "회사를 활성화했습니다." : "회사를 비활성화했습니다. 기존 숙소 데이터는 유지됩니다." }; }
  catch (error) { logServerError("setCompanyActive", error); return { success: false, message: "회사 상태를 변경하지 못했습니다." }; }
}
