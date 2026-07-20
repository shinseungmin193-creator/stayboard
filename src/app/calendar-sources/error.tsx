"use client";
import { RouteError } from "@/components/shared/route-error";
export default function ErrorPage({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) { return <RouteError error={error} retry={unstable_retry} />; }
