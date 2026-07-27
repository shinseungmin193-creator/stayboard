import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Next.js runtime-specific instrumentation requires conditional CommonJS loading.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { onNodeRequestError } = require("./instrumentation-node") as typeof import("./instrumentation-node");
    await onNodeRequestError(error, request, context);
  }
};
