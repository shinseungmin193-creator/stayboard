export interface SessionAccountSnapshot {
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  isActive: boolean;
  sessionVersion: number;
}

export function isSessionSnapshotValid(
  account: SessionAccountSnapshot | null,
  tokenSessionVersion: unknown,
) {
  return Boolean(
    account &&
      account.status === "ACTIVE" &&
      account.isActive &&
      typeof tokenSessionVersion === "number" &&
      tokenSessionVersion === account.sessionVersion,
  );
}
