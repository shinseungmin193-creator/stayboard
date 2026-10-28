"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { authorizeAccess, FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requirePropertyAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError, isPrismaUniqueError, logServerError } from "@/lib/prisma-errors";
import { findCompany } from "@/features/companies";
import { createProperty, propertyExists, setPropertyActive, updateProperty } from "./property.repository";
import { propertyActiveSchema, propertyDeleteImpactSchema, propertyDeleteSchema, propertyInputSchema, propertyUpdateSchema } from "./property.schemas";
import {
  deletePropertySafely,
  getPropertyDeleteImpact,
  getPropertyDeleteTarget,
  PropertyDeletionServiceError,
} from "./property-deletion.service";
import type { PropertyDeleteImpact, PropertyDeleteResult } from "./property.types";

function fields(formData: FormData) { return { companyId: formData.get("companyId"), name: formData.get("name"), address: formData.get("address"), timezone: formData.get("timezone") || "Asia/Tokyo" }; }
function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionResult { return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: error.flatten().fieldErrors }; }
const PROPERTY_DATA_PATHS = [
  "/",
  "/properties",
  "/rooms",
  "/calendar-sources",
  "/reservations",
  "/room-overview",
  "/room-status",
  "/dashboard",
  "/reservation-conflicts",
  "/cleaning",
  "/room-notes",
  "/property-reviews",
  "/statistics/occupancy",
] as const;
function revalidatePropertyData() { for (const path of PROPERTY_DATA_PATHS) revalidatePath(path); }

export async function createPropertyAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertyInputSchema.safeParse(fields(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const access = await authorizeAccess(PERMISSIONS.PROPERTY_MANAGE, parsed.data.companyId);
  if (!access.allowed) return FORBIDDEN_ACTION_RESULT;
  try {
    const company = await findCompany(parsed.data.companyId);
    if (!company) return { success: false, message: "선택한 회사가 존재하지 않습니다." };
    if (!company.isActive) return { success: false, message: "비활성 회사에는 새 숙소를 등록할 수 없습니다." };
    await createProperty(parsed.data);
    revalidatePropertyData();
    return { success: true, message: "숙소를 등록했습니다." };
  } catch (error) {
    if (isPrismaUniqueError(error)) return { success: false, message: "같은 회사에 동일한 숙소명이 이미 있습니다." };
    return actionFailureFromError(error, "createProperty");
  }
}

export async function updatePropertyAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertyUpdateSchema.safeParse({ id: formData.get("id"), ...fields(formData) });
  if (!parsed.success) return validationFailure(parsed.error);
  const { id, ...data } = parsed.data;
  try {
    await requirePropertyAccess(id, PERMISSIONS.PROPERTY_MANAGE);
    const targetAccess = await authorizeAccess(PERMISSIONS.PROPERTY_MANAGE, data.companyId);
    if (!targetAccess.allowed) return FORBIDDEN_ACTION_RESULT;
    const company = await findCompany(data.companyId);
    if (!company) return { success: false, message: "선택한 회사가 존재하지 않습니다." };
    await updateProperty(id, data);
    revalidatePropertyData();
    return { success: true, message: "숙소 정보를 수정했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (isPrismaUniqueError(error)) return { success: false, message: "같은 회사에 동일한 숙소명이 이미 있습니다." };
    logServerError("updateProperty", error);
    return { success: false, message: "숙소 정보를 수정하지 못했습니다." };
  }
}

export async function setPropertyActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = propertyActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") });
  if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  try {
    await requirePropertyAccess(parsed.data.id, PERMISSIONS.PROPERTY_MANAGE);
    const current = await propertyExists(parsed.data.id);
    if (!current) return { success: false, message: "숙소를 찾을 수 없습니다." };
    if (current.isActive === parsed.data.isActive) return { success: true, message: "이미 요청한 상태입니다." };
    await setPropertyActive(parsed.data.id, parsed.data.isActive);
    revalidatePropertyData();
    return { success: true, message: parsed.data.isActive ? "숙소를 활성화했습니다." : "숙소를 비활성화했습니다. 기존 객실과 예약 데이터는 유지됩니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    logServerError("setPropertyActive", error);
    return { success: false, message: "숙소 상태를 변경하지 못했습니다." };
  }
}

async function propertyDeletionFailure<T>(error: unknown, context: string): Promise<ActionResult<T>> {
  const t = await getTranslations("propertyDeletion");
  if (isAccessControlError(error)) return { ...FORBIDDEN_ACTION_RESULT, message: t("errors.forbidden") };
  if (error instanceof PropertyDeletionServiceError) {
    if (error.code === "NOT_FOUND") return { success: false, status: 404, errorCode: "NOT_FOUND", message: t("errors.notFound") };
    if (error.code === "CONFIRMATION_MISMATCH") return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.confirmation") };
    if (error.code === "RELATED_OPERATION_IN_PROGRESS") return { success: false, status: 409, errorCode: "SYNC_FAILED", message: t("errors.operationInProgress") };
    return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: t("errors.scopeChanged") };
  }
  const failure = await actionFailureFromError(error, context);
  return { ...failure, message: t("errors.failed") };
}

export async function getPropertyDeleteImpactAction(propertyId: string): Promise<ActionResult<PropertyDeleteImpact>> {
  const parsed = propertyDeleteImpactSchema.safeParse({ propertyId });
  const t = await getTranslations("propertyDeletion");
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.invalidRequest") };
  try {
    await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.PROPERTY_MANAGE);
    const target = await getPropertyDeleteTarget(parsed.data.propertyId);
    return { success: true, data: await getPropertyDeleteImpact(target.id) };
  } catch (error) {
    return propertyDeletionFailure<PropertyDeleteImpact>(error, "getPropertyDeleteImpact");
  }
}

export async function deletePropertyAction(input: {
  propertyId: string;
  confirmationText: string;
}): Promise<ActionResult<PropertyDeleteResult>> {
  const parsed = propertyDeleteSchema.safeParse(input);
  const t = await getTranslations("propertyDeletion");
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: t("errors.invalidRequest") };
  try {
    const context = await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.PROPERTY_MANAGE);
    const target = await getPropertyDeleteTarget(parsed.data.propertyId);
    const data = await deletePropertySafely({
      target,
      confirmationText: parsed.data.confirmationText,
      context,
    });
    revalidatePropertyData();
    const message = data.failedPhotoFileCount > 0
      ? t("successWithPhotoWarning", { name: data.propertyName, count: data.failedPhotoFileCount })
      : t("success", { name: data.propertyName });
    return { success: true, data, message };
  } catch (error) {
    return propertyDeletionFailure<PropertyDeleteResult>(error, "deleteProperty");
  }
}
