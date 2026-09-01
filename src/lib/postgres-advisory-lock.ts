import "server-only";

import { Client } from "pg";

export class AdvisoryLockUnavailableError extends Error {
  constructor(public readonly lockKey: string) {
    super("ADVISORY_LOCK_UNAVAILABLE");
    this.name = "AdvisoryLockUnavailableError";
  }
}

export async function withPostgresAdvisoryLocks<T>(keys: readonly string[], operation: () => Promise<T>): Promise<T> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
  const client = new Client({ connectionString });
  const acquiredKeys: string[] = [];
  let primaryError: unknown;
  try {
    await client.connect();
    for (const key of keys) {
      const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired", [key]);
      if (result.rows[0]?.acquired !== true) throw new AdvisoryLockUnavailableError(key);
      acquiredKeys.push(key);
    }
    return await operation();
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    let cleanupFailed = false;
    for (const key of [...acquiredKeys].reverse()) {
      try {
        const result = await client.query<{ released: boolean }>("SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released", [key]);
        if (result.rows[0]?.released !== true) cleanupFailed = true;
      } catch { cleanupFailed = true; }
    }
    try { await client.end(); } catch { cleanupFailed = true; }
    if (!primaryError && cleanupFailed) throw new Error("동기화 잠금 연결을 안전하게 정리하지 못했습니다.");
  }
}
