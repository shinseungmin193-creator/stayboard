import { z } from "zod";
import { isValidDateInput } from "@/lib/zoned-date";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar";

export const reservationConflictDismissSchema = z.object({
  conflictId: z.string().trim().min(1).max(64),
});

const optionalId = z.string().trim().min(1).max(64).optional();
const dateInput = z.string().refine(isValidDateInput);

export const reservationConflictBulkDismissSchema = z.object({
  propertyId: optionalId,
  roomId: optionalId,
  provider: z.enum(CALENDAR_PROVIDER_TYPES).optional(),
  from: dateInput,
  to: dateInput,
});
