import type { Prisma } from "../../../lib/generated/prisma/client";

export function buildCompletedCleaningHistoryWhere(input: {
  roomWhere?: Prisma.RoomWhereInput;
  companyId?: string | null;
  propertyId?: string | null;
  roomId?: string | null;
  assigneeId?: string | null;
}): Prisma.CleaningTaskWhereInput {
  return {
    AND: [
      input.roomWhere ? { room: { is: input.roomWhere } } : {},
      { status: "COMPLETED" },
      input.companyId ? { companyId: input.companyId } : {},
      input.propertyId ? { propertyId: input.propertyId } : {},
      input.roomId ? { roomId: input.roomId } : {},
      input.assigneeId && input.assigneeId !== "unassigned" ? { assignedToId: input.assigneeId } : {},
    ],
  };
}
