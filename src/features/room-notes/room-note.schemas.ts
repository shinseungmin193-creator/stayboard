import { z } from "zod";

export const createRoomNoteSchema = z.object({
  propertyId: z.string().trim().min(1).max(100),
  roomId: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(1000),
});

export const roomNoteIdSchema = z.object({ id: z.string().trim().min(1).max(100) });

export const roomNoteRoomIdSchema = z.object({ roomId: z.string().trim().min(1).max(100) });

export const openRoomInspectionSchema = roomNoteRoomIdSchema.extend({
  includeResolved: z.boolean().default(false),
});

export const updateRoomNoteSchema = roomNoteIdSchema.extend({
  content: z.string().trim().min(1).max(1000),
});

export const saveRoomNoteProcessingSchema = roomNoteIdSchema.extend({
  resolutionNote: z.string().trim().max(2000),
  resolved: z.boolean(),
});

export const changeRoomNoteStatusSchema = roomNoteIdSchema.extend({
  status: z.enum(["OPEN", "COMPLETED"]),
});
