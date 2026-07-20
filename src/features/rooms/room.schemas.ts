import { z } from "zod";
import { NAME_MAX_LENGTH, ROOM_CAPACITY_MAX, ROOM_CODE_MAX_LENGTH, ROOM_SORT_ORDER_MAX } from "@/lib/constants";

export const roomInputSchema = z.object({
  propertyId: z.string().trim().min(1, "숙소를 선택해 주세요."),
  name: z.string().trim().min(1, "객실명을 입력해 주세요.").max(NAME_MAX_LENGTH),
  code: z.string().trim().min(1, "객실 코드를 입력해 주세요.").max(ROOM_CODE_MAX_LENGTH),
  capacity: z.coerce.number().int("수용 인원은 정수여야 합니다.").min(1, "수용 인원은 1명 이상이어야 합니다.").max(ROOM_CAPACITY_MAX),
  sortOrder: z.coerce.number().int("정렬 순서는 정수여야 합니다.").min(0, "정렬 순서는 0 이상이어야 합니다.").max(ROOM_SORT_ORDER_MAX),
});
export const roomUpdateSchema = roomInputSchema.extend({ id: z.string().trim().min(1) });
export const roomActiveSchema = z.object({ id: z.string().trim().min(1), isActive: z.enum(["true", "false"]).transform((value) => value === "true") });
