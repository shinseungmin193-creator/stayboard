export type CleaningWorkflowStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface CleaningWorkflowSnapshot {
  status: CleaningWorkflowStatus;
  assigneeUserId: string | null;
  assigneeName: string | null;
  assignedByUserId: string | null;
}

export function getInitialCleaningWorkflowWorkerName(input: {
  mode: "start" | "complete";
  cleanerName?: string | null;
  assigneeName?: string | null;
}) {
  if (input.mode === "start") return "";
  return input.cleanerName?.trim() || input.assigneeName?.trim() || "";
}

export type CleaningWorkflowErrorCode =
  | "NOT_ACTIONABLE"
  | "NAME_REQUIRED"
  | "ALREADY_ASSIGNED"
  | "ASSIGNEE_REQUIRED"
  | "ALREADY_COMPLETED"
  | "NOT_IN_PROGRESS";

export class CleaningWorkflowError extends Error {
  constructor(public readonly code: CleaningWorkflowErrorCode) {
    super(code);
    this.name = "CleaningWorkflowError";
  }
}

export function normalizeCleaningWorkerName(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  if (normalized.length < 1 || normalized.length > 30) throw new CleaningWorkflowError("NAME_REQUIRED");
  return normalized;
}

export function resolveCleaningAssignmentWorkerName(input: {
  assigneeRole: "DEVELOPER" | "ADMIN" | "STAFF";
  accountName: string;
  workerName?: string | null;
}) {
  return normalizeCleaningWorkerName(input.assigneeRole === "STAFF" ? input.workerName : input.accountName);
}

export function hasCleaningAssignee(task: Pick<CleaningWorkflowSnapshot, "assigneeUserId" | "assigneeName">) {
  return Boolean(task.assigneeUserId || task.assigneeName?.trim());
}

export function assertCleaningTaskActionable(status: CleaningWorkflowStatus) {
  if (status !== "PENDING" && status !== "IN_PROGRESS") throw new CleaningWorkflowError("NOT_ACTIONABLE");
}

export function planCleaningAssignment(task: CleaningWorkflowSnapshot, workerName: string) {
  assertCleaningTaskActionable(task.status);
  if (hasCleaningAssignee(task)) throw new CleaningWorkflowError("ALREADY_ASSIGNED");
  return { workerName: normalizeCleaningWorkerName(workerName) };
}

export function planCleaningStart(task: CleaningWorkflowSnapshot, workerName?: string | null) {
  if (task.status !== "PENDING") throw new CleaningWorkflowError("NOT_ACTIONABLE");
  const normalizedWorkerName = normalizeCleaningWorkerName(workerName);
  return { shouldAssign: !hasCleaningAssignee(task), workerName: normalizedWorkerName };
}

export function planCleaningStartCancellation(status: CleaningWorkflowStatus) {
  if (status === "COMPLETED") throw new CleaningWorkflowError("ALREADY_COMPLETED");
  if (status !== "IN_PROGRESS") throw new CleaningWorkflowError("NOT_IN_PROGRESS");
  return {
    status: "PENDING" as const,
    startedAt: null,
    startedById: null,
    startedByName: null,
    cleanerName: null,
  };
}

export function planCleaningCompletion(task: CleaningWorkflowSnapshot, workerName?: string | null) {
  assertCleaningTaskActionable(task.status);
  const normalizedWorkerName = normalizeCleaningWorkerName(workerName);
  return { shouldAssign: !hasCleaningAssignee(task), workerName: normalizedWorkerName };
}
