"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { isPrismaUniqueError, logServerError } from "@/lib/prisma-errors";
import { findCompany } from "@/features/companies";
import { createProperty, propertyExists, setPropertyActive, updateProperty } from "./property.repository";
import { propertyActiveSchema, propertyInputSchema, propertyUpdateSchema } from "./property.schemas";

function fields(formData: FormData) { return { companyId: formData.get("companyId"), name: formData.get("name"), address: formData.get("address"), timezone: formData.get("timezone") || "Asia/Tokyo" }; }
function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionResult { return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: error.flatten().fieldErrors }; }

export async function createPropertyAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertyInputSchema.safeParse(fields(formData)); if (!parsed.success) return validationFailure(parsed.error);
  try { const company = await findCompany(parsed.data.companyId); if (!company) return { success: false, message: "선택한 회사가 존재하지 않습니다." }; if (!company.isActive) return { success: false, message: "비활성 회사에는 새 숙소를 등록할 수 없습니다." }; await createProperty(parsed.data); revalidatePath("/properties"); revalidatePath("/rooms"); return { success: true, message: "숙소를 등록했습니다." }; }
  catch (error) { if (isPrismaUniqueError(error)) return { success: false, message: "같은 회사에 동일한 숙소명이 이미 있습니다." }; logServerError("createProperty", error); return { success: false, message: "숙소를 등록하지 못했습니다. 데이터베이스 연결을 확인해 주세요." }; }
}

export async function updatePropertyAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertyUpdateSchema.safeParse({ id: formData.get("id"), ...fields(formData) }); if (!parsed.success) return validationFailure(parsed.error);
  const { id, ...data } = parsed.data;
  try { const company = await findCompany(data.companyId); if (!company) return { success: false, message: "선택한 회사가 존재하지 않습니다." }; await updateProperty(id, data); revalidatePath("/properties"); revalidatePath("/rooms"); return { success: true, message: "숙소 정보를 수정했습니다." }; }
  catch (error) { if (isPrismaUniqueError(error)) return { success: false, message: "같은 회사에 동일한 숙소명이 이미 있습니다." }; logServerError("updateProperty", error); return { success: false, message: "숙소 정보를 수정하지 못했습니다." }; }
}

export async function setPropertyActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertyActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") }); if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  try { const current = await propertyExists(parsed.data.id); if (!current) return { success: false, message: "숙소를 찾을 수 없습니다." }; if (current.isActive === parsed.data.isActive) return { success: true, message: "이미 요청한 상태입니다." }; await setPropertyActive(parsed.data.id, parsed.data.isActive); revalidatePath("/properties"); revalidatePath("/rooms"); return { success: true, message: parsed.data.isActive ? "숙소를 활성화했습니다." : "숙소를 비활성화했습니다. 기존 객실과 예약 데이터는 유지됩니다." }; }
  catch (error) { logServerError("setPropertyActive", error); return { success: false, message: "숙소 상태를 변경하지 못했습니다." }; }
}
