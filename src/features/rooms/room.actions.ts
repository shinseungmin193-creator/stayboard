"use server";
import { revalidatePath } from "next/cache";
import { authorizeAccess, FORBIDDEN_ACTION_RESULT, isAccessControlError, PERMISSIONS, requirePropertyAccess, requireRoomAccess } from "@/features/access-control";
import type { CalendarDraftConnectionResult } from "@/features/calendar-sources/calendar-source.types";
import { CalendarSourceServiceError, normalizeCalendarUrl, testCalendarUrlConnection } from "@/features/calendar-sources/calendar-source.service";
import type { ActionResult } from "@/lib/action-result";
import { actionFailureFromError, isPrismaUniqueError, logServerError } from "@/lib/prisma-errors";
import { propertyExists } from "@/features/properties";
import { createRoomWithCalendarSources, findRoomWithCalendarSourcesForUpdate, roomExists, setRoomActive, updateRoom, updateRoomWithCalendarSourcesAtomically } from "./room.repository";
import { roomActiveSchema, roomInputSchema, roomUpdateSchema, roomWithCalendarSourcesUpdateSchema } from "./room.schemas";
import { createRoomRegistration, RoomRegistrationError } from "./create-room-registration";
import { calendarUrlField, prepareRoomCalendarDrafts, ROOM_CALENDAR_PROVIDER_CONFIG, testedCalendarUrlField, type RoomCalendarProvider, type SupportedRoomCalendarProvider } from "./room-calendar-draft";
import { updateRoomWithCalendarSources, UpdateRoomCalendarError, type UpdateRoomWithCalendarSourcesInput } from "./update-room-with-calendar-sources";

function fields(formData: FormData) { return { propertyId: formData.get("propertyId"), name: formData.get("name"), capacity: formData.get("capacity") }; }
function validationFailure(error: { flatten(): { fieldErrors: Record<string, string[]> } }): ActionResult { return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors: error.flatten().fieldErrors }; }

export async function createRoomAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = roomInputSchema.safeParse(fields(formData)); if (!parsed.success) return validationFailure(parsed.error);
  try { await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.ROOM_MANAGE); } catch (error) { if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT; throw error; }
  const draftResult = prepareRoomCalendarDrafts(ROOM_CALENDAR_PROVIDER_CONFIG.map(({ provider }) => ({ provider, calendarUrl: String(formData.get(calendarUrlField(provider)) ?? ""), testedCalendarUrl: String(formData.get(testedCalendarUrlField(provider)) ?? "") })));
  if (!draftResult.success) return { success: false, message: "OTA 캘린더 연결 상태를 확인해 주세요.", fieldErrors: Object.fromEntries(Object.entries(draftResult.errors).map(([provider, error]) => [calendarUrlField(provider as RoomCalendarProvider), error ? [error.message] : []])) };
  try { const property = await propertyExists(parsed.data.propertyId); if (!property) return { success: false, message: "선택한 숙소가 존재하지 않습니다." }; if (!property.isActive) return { success: false, message: "비활성 숙소에는 새 객실을 등록할 수 없습니다." }; const calendars = draftResult.drafts.map((draft) => ({ ...draft, name: `${parsed.data.name} ${ROOM_CALENDAR_PROVIDER_CONFIG.find((item) => item.provider === draft.provider)?.label ?? draft.provider}` })); await createRoomRegistration({ room: parsed.data, calendars }, { testConnection: testCalendarUrlConnection, createAtomically: createRoomWithCalendarSources }); revalidatePath("/rooms"); revalidatePath("/properties"); revalidatePath("/calendar-sources"); return { success: true, message: calendars.length ? `객실과 캘린더 연결 ${calendars.length}개를 등록했습니다.` : "객실을 등록했습니다." }; }
  catch (error) { if (error instanceof RoomRegistrationError) return { success: false, status: 502, errorCode: "SYNC_FAILED", message: "캘린더 연결 테스트에 실패했습니다.", fieldErrors: { [calendarUrlField(error.provider)]: [error.message] } }; if (isPrismaUniqueError(error)) return { success: false, status: 422, errorCode: "VALIDATION_ERROR", message: "같은 객실에 중복된 캘린더 URL이 있습니다." }; return actionFailureFromError(error, "createRoom"); }
}

export type RoomCalendarTestActionResult =
  | { success: true; data: CalendarDraftConnectionResult; message: string }
  | { success: false; submittedUrl: string; code: CalendarSourceServiceError["code"] | "INVALID_INPUT"; message: string };

export async function testRoomCalendarUrlAction(input: { provider: RoomCalendarProvider; calendarUrl: string }): Promise<RoomCalendarTestActionResult> {
  const access = await authorizeAccess(PERMISSIONS.ROOM_MANAGE);
  if (!access.allowed) return { success: false, submittedUrl: input.calendarUrl, code: "INVALID_INPUT", message: FORBIDDEN_ACTION_RESULT.message };
  const config = ROOM_CALENDAR_PROVIDER_CONFIG.find((item) => item.provider === input.provider);
  if (!config?.supported) return { success: false, submittedUrl: input.calendarUrl, code: "UNSUPPORTED", message: "이 Provider는 아직 iCal 연결 테스트를 지원하지 않습니다." };
  if (!input.calendarUrl.trim()) return { success: false, submittedUrl: input.calendarUrl, code: "INVALID_INPUT", message: "iCal URL을 입력해 주세요." };
  try { const data = await testCalendarUrlConnection(input.provider as SupportedRoomCalendarProvider, input.calendarUrl); return { success: true, data, message: "연결 성공" }; }
  catch (error) { if (error instanceof CalendarSourceServiceError) return { success: false, submittedUrl: input.calendarUrl, code: error.code, message: error.message }; logServerError("testRoomCalendarUrl", error); return { success: false, submittedUrl: input.calendarUrl, code: "FETCH", message: "연결 테스트 중 알 수 없는 오류가 발생했습니다." }; }
}
export async function updateRoomAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = roomUpdateSchema.safeParse({ id: formData.get("id"), ...fields(formData) }); if (!parsed.success) return validationFailure(parsed.error); const { id, ...data } = parsed.data;
  try { await requireRoomAccess(id, PERMISSIONS.ROOM_MANAGE); await requirePropertyAccess(data.propertyId, PERMISSIONS.ROOM_MANAGE); const property = await propertyExists(data.propertyId); if (!property) return { success: false, message: "선택한 숙소가 존재하지 않습니다." }; await updateRoom(id, data); revalidatePath("/rooms"); revalidatePath("/properties"); return { success: true, message: "객실 정보를 수정했습니다." }; }
  catch (error) { if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT; if (isPrismaUniqueError(error)) return { success: false, message: "객실 내부 식별자를 저장하지 못했습니다. 다시 시도해 주세요." }; logServerError("updateRoom", error); return { success: false, message: "객실 정보를 수정하지 못했습니다." }; }
}

export type UpdateRoomWithCalendarSourcesActionResult =
  | { success: true; message: string }
  | { success: false; message: string; fieldErrors?: Record<string, string[]>; sourceErrors?: Record<string, string[]> };

function calendarUpdateValidationFailure(
  input: unknown,
  issues: Array<{ path: PropertyKey[]; message: string }>,
): UpdateRoomWithCalendarSourcesActionResult {
  const fieldErrors: Record<string, string[]> = {};
  const sourceErrors: Record<string, string[]> = {};
  const sources = typeof input === "object" && input !== null && "sources" in input && Array.isArray(input.sources)
    ? input.sources
    : [];
  for (const issue of issues) {
    if (issue.path[0] === "sources" && typeof issue.path[1] === "number") {
      const source = sources[issue.path[1]];
      const key = typeof source === "object" && source !== null && "clientKey" in source && typeof source.clientKey === "string"
        ? source.clientKey
        : undefined;
      if (key) sourceErrors[key] = [...(sourceErrors[key] ?? []), issue.message];
      continue;
    }
    const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return { success: false, message: "입력 내용을 확인해 주세요.", fieldErrors, sourceErrors };
}

export async function updateRoomWithCalendarSourcesAction(
  input: UpdateRoomWithCalendarSourcesInput,
): Promise<UpdateRoomWithCalendarSourcesActionResult> {
  const parsed = roomWithCalendarSourcesUpdateSchema.safeParse(input);
  if (!parsed.success) return calendarUpdateValidationFailure(input, parsed.error.issues);
  try {
    await requireRoomAccess(parsed.data.id, PERMISSIONS.ROOM_MANAGE);
    await requirePropertyAccess(parsed.data.propertyId, PERMISSIONS.ROOM_MANAGE);
    const result = await updateRoomWithCalendarSources(parsed.data, {
      findRoom: findRoomWithCalendarSourcesForUpdate,
      propertyExists,
      testConnection: testCalendarUrlConnection,
      normalizeUrl: normalizeCalendarUrl,
      updateAtomically: updateRoomWithCalendarSourcesAtomically,
    });
    revalidatePath("/rooms");
    revalidatePath("/properties");
    revalidatePath("/calendar-sources");
    revalidatePath("/room-overview");
    revalidatePath("/room-status");
    return {
      success: true,
      message: `객실 정보와 캘린더 연결을 저장했습니다. 신규 ${result.createdSourceCount}개 · 변경 ${result.updatedSourceCount}개`,
    };
  } catch (error) {
    if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT;
    if (error instanceof UpdateRoomCalendarError) {
      return {
        success: false,
        message: error.message,
        sourceErrors: error.sourceKey ? { [error.sourceKey]: [error.message] } : undefined,
      };
    }
    if (isPrismaUniqueError(error)) {
      return { success: false, message: "같은 객실에 동일한 iCal URL이 이미 등록되어 있습니다." };
    }
    if (process.env.NODE_ENV === "development") console.error("[updateRoomWithCalendarSources]", error instanceof Error ? error.name : "UnknownError");
    return { success: false, message: "객실과 캘린더 연결을 저장하지 못했습니다." };
  }
}
export async function setRoomActiveAction(_state: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = roomActiveSchema.safeParse({ id: formData.get("id"), isActive: formData.get("isActive") }); if (!parsed.success) return { success: false, message: "잘못된 상태 변경 요청입니다." };
  try { await requireRoomAccess(parsed.data.id, PERMISSIONS.ROOM_MANAGE); const current = await roomExists(parsed.data.id); if (!current) return { success: false, message: "객실을 찾을 수 없습니다." }; if (current.isActive === parsed.data.isActive) return { success: true, message: "이미 요청한 상태입니다." }; await setRoomActive(parsed.data.id, parsed.data.isActive); revalidatePath("/rooms"); revalidatePath("/properties"); return { success: true, message: parsed.data.isActive ? "객실을 활성화했습니다." : "객실을 비활성화했습니다. 연결 정보와 예약 데이터는 유지됩니다." }; }
  catch (error) { if (isAccessControlError(error)) return FORBIDDEN_ACTION_RESULT; logServerError("setRoomActive", error); return { success: false, message: "객실 상태를 변경하지 못했습니다." }; }
}
