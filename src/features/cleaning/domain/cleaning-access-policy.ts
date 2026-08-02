export function canWorkOnCleaningTask(input: {
  role: "DEVELOPER" | "ADMIN" | "STAFF";
  userId: string;
  assignedToId: string | null;
  assigneeName?: string | null;
  assignedById?: string | null;
}) {
  if (input.role !== "STAFF") return true;
  const hasAssignee = Boolean(input.assignedToId || input.assigneeName?.trim());
  return !hasAssignee
    || input.assignedToId === input.userId
    || (input.assignedToId === null && input.assignedById === input.userId);
}
