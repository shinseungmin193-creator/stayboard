"use client";

import { RouteError } from "@/components/shared/route-error";

export default function DeveloperError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} retry={reset} />;
}
