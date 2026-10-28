import type { Instrumentation } from "next";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs"
    && process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { registerNodeInstrumentation } = await import("./instrumentation-node");
    registerNodeInstrumentation();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { onNodeRequestError } = await import("./instrumentation-node");
    await onNodeRequestError(error, request, context);
  }
};
