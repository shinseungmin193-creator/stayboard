export function canWorkOnCleaningTask(input: {
  role: "DEVELOPER" | "ADMIN" | "STAFF";
  userId: string;
  assignedToId: string | null;
}) {
  return input.role !== "STAFF" || input.assignedToId === null || input.assignedToId === input.userId;
}
