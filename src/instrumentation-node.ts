import type { Instrumentation } from "next";
import { saveErrorLog } from "@/features/error-logs/error-log.repository";
import { classifyServerError } from "@/lib/server-error";

export const onNodeRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const classified = classifyServerError(error);
  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : null;

  await saveErrorLog({
    ...classified,
    digest,
    apiRoute: request.path,
    routeType: context.routeType,
  });
};
