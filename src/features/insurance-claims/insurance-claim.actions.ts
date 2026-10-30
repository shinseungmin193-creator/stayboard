"use server";

import { revalidatePath } from "next/cache";
import { FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requireRoomAccess } from "@/features/access-control";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError } from "@/lib/prisma-errors";
import { createInsuranceClaimSchema, deleteInsuranceClaimSchema, submitInsuranceClaimSchema } from "./insurance-claim.schemas";
import { requireInsuranceClaimAccess } from "./server/insurance-claim-access";
import { createInsuranceClaim, deleteSubmittedInsuranceClaim, InsuranceClaimServiceError, submitInsuranceClaim } from "./server/insurance-claim.service";

function revalidateInsuranceViews() {
  revalidatePath("/room-overview");
  revalidatePath("/insurance-claims");
}

export async function createInsuranceClaimAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createInsuranceClaimSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "보고 내용을 확인해 주세요.", fieldErrors: parsed.error.flatten().fieldErrors };
  try {
    const context = await requireRoomAccess(parsed.data.roomId, PERMISSIONS.INSURANCE_CLAIM_CREATE);
    const claim = await createInsuranceClaim(context, parsed.data);
    revalidateInsuranceViews();
    return { success: true, data: claim, message: "보험/보상 보고를 등록했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof InsuranceClaimServiceError) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "createInsuranceClaim");
  }
}

export async function submitInsuranceClaimAction(input: unknown): Promise<ActionResult<Awaited<ReturnType<typeof submitInsuranceClaim>>>> {
  const parsed = submitInsuranceClaimSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "신청 종류를 하나 이상 선택해 주세요." };
  try {
    const { context } = await requireInsuranceClaimAccess(parsed.data.id, PERMISSIONS.INSURANCE_CLAIM_COMPLETE);
    const result = await submitInsuranceClaim(context, parsed.data.id, parsed.data.types);
    revalidateInsuranceViews();
    return { success: true, data: result, message: "신청 완료했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof InsuranceClaimServiceError) return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "submitInsuranceClaim");
  }
}

export async function deleteInsuranceClaimAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteInsuranceClaimSchema.safeParse(input);
  if (!parsed.success) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "삭제할 보고를 확인해 주세요." };
  try {
    const { context } = await requireInsuranceClaimAccess(parsed.data.id, PERMISSIONS.INSURANCE_CLAIM_DELETE);
    const result = await deleteSubmittedInsuranceClaim(context, parsed.data.id);
    revalidateInsuranceViews();
    return { success: true, data: result, message: "신청 완료 보고를 삭제했습니다." };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof InsuranceClaimServiceError) return { success: false, status: 409, errorCode: "VALIDATION_ERROR", message: error.message };
    return actionFailureFromError(error, "deleteInsuranceClaim");
  }
}

