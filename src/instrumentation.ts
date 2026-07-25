import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const [{ classifyServerError }, { saveErrorLog }] = await Promise.all([import("@/lib/server-error"), import("@/features/error-logs/error-log.repository")]);
  const classified = classifyServerError(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : null;
  await saveErrorLog({ ...classified, digest, apiRoute: request.path, routeType: context.routeType });
};
