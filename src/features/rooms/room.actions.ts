"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { isPrismaUniqueError, logServerError } from "@/lib/prisma-errors";
import { propertyExists } from "@/features/properties";
import { createRoom, roomExists, setRoomActive, updateRoom } from "./room.repository";
import { roomActiveSchema, roomInputSchema, roomUpdateSchema } from "./room.schemas";

function fields(formData: FormData) { return { propertyId: formData.get("propertyId"), name: formData.get("name"), code: formData.get("code"), capacity: formData.get("capacity"), sortOrder: formData.get("sortOrder") }; }
function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionResult { return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: error.flatten().fieldErrors }; }

export async function createRoomAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = roomInputSchema.safeParse(fields(formData)); if (!parsed.success) return validationFailure(parsed.error);
  try { const property = await propertyExists(parsed.data.propertyId); if (!property) return { success: false, message: "선택한 숙소가 존재하지 않습니다." }; if (!property.isActive) return { success: false, message: "비활성 숙소에는 새 객실을 등록할 수 없습니다." }; await createRoom(parsed.data); revalidatePath("/rooms"); revalidatePath("/properties"); return { success: true, message: "객실을 등록했습니다." }; }
  catch (error) { if (isPrismaUniqueError(error)) return { success: false, message: "같은 숙소에 동일한 객실 코드가 이미 있습니다." }; logServerError("createRoom", error); return { success: false, message: "객실을 등록하지 못했습니다. 데이터베이스 연결을 확인해 주세요." }; }
}
export async function updateRoomAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = roomUpdateSchema.safeParse({ id: formData.get("id"), ...fields(formData) }); if (!parsed.success) return validationFailure(parsed.error); const { id, ...data } = parsed.data;
  try { const property = await propertyExists(data.propertyId); if (!property) return { success: false, message: "선택한 숙소가 존재하지 않습니다." }; await updateRoom(id, data); revalidatePath("/rooms"); revalidatePath("/properties"); return { success: true, message: "객실 정보를 수정했습니다." }; }
  catch (error) { if (isPrismaUniqueError(error)) return { success: false, message: "같은 숙소에 동일한 객실 코드가 이미 있습니다." }; logServerError("updateRoom", error); return { success: false, message: "객실 정보를 수정하지 못했습니다." }; }
}
export async function setRoomActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = roomActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") }); if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  try { const current = await roomExists(parsed.data.id); if (!current) return { success: false, message: "객실을 찾을 수 없습니다." }; if (current.isActive === parsed.data.isActive) return { success: true, message: "이미 요청한 상태입니다." }; await setRoomActive(parsed.data.id, parsed.data.isActive); revalidatePath("/rooms"); revalidatePath("/properties"); return { success: true, message: parsed.data.isActive ? "객실을 활성화했습니다." : "객실을 비활성화했습니다. 연결 정보와 예약 데이터는 유지됩니다." }; }
  catch (error) { logServerError("setRoomActive", error); return { success: false, message: "객실 상태를 변경하지 못했습니다." }; }
}
