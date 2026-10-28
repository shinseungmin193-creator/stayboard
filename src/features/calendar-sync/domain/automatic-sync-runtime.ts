export function shouldRunAutomaticSyncInWeb(
  env: { CALENDAR_AUTO_SYNC_RUNNER?: string } = {
    CALENDAR_AUTO_SYNC_RUNNER: process.env.CALENDAR_AUTO_SYNC_RUNNER,
  },
) {
  return env.CALENDAR_AUTO_SYNC_RUNNER?.trim().toLowerCase() !== "external";
}
