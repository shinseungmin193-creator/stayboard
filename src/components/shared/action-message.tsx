import type { ActionResult } from "@/lib/action-result";
export function ActionMessage({ result }: { result: ActionResult }) { if (!result.message) return null; return <p aria-live="polite" className={`rounded-md px-3 py-2 text-xs ${result.success ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>{result.message}</p>; }
