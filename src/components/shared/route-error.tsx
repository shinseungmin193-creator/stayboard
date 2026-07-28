"use client";import { useTranslations } from "next-intl";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_ERROR_MESSAGES, UNKNOWN_ERROR_RESPONSE, isAppErrorCode, type AppErrorResponse, type DeveloperErrorDetails } from "@/lib/app-error";
import { withBasePath } from "@/lib/base-path";

type ErrorPayload = AppErrorResponse & {details?: DeveloperErrorDetails;};

export function RouteError({ error, retry }: {error: Error & {digest?: string;};retry: () => void;}) {const i18n = useTranslations();
  const [payload, setPayload] = useState<ErrorPayload>(UNKNOWN_ERROR_RESPONSE);
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(withBasePath("/api/error-logs"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ digest: error.digest, message: error.message, stack: error.stack, apiRoute: window.location.pathname }), signal: controller.signal }).
    then(async (response) => {const value = (await response.json()) as Partial<ErrorPayload>;if (typeof value.status === "number" && isAppErrorCode(value.errorCode)) setPayload({ status: value.status, errorCode: value.errorCode, message: value.message ?? APP_ERROR_MESSAGES[value.errorCode], details: value.details });}).
    catch(() => undefined);
    return () => controller.abort();
  }, [error]);
  return <Card><CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center"><AlertTriangle className="mb-4 size-8 text-destructive" /><h2 className="text-lg font-semibold">{i18n("auto.m0122")}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{payload.message}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{payload.errorCode} · {i18n("technical.http")} {payload.status}</p>
    {payload.details && <details className="mt-4 w-full max-w-2xl rounded-lg border p-3 text-left text-xs"><summary className="flex cursor-pointer items-center gap-2 font-medium"><ChevronDown className="size-4" />{i18n("auto.m0053")}</summary><dl className="mt-3 grid gap-2"><Detail label="Error Code" value={payload.details.errorCode} /><Detail label="API Route" value={payload.details.apiRoute} /><Detail label={i18n("auto.m0123")} value={payload.details.originalMessage} /><Detail label="Prisma Error" value={payload.details.prismaError} /><Detail label="SQL Error" value={payload.details.sqlError} /><Detail label="Stack" value={payload.details.stack} mono /></dl></details>}
    <Button className="mt-5" variant="outline" disabled={isPending} onClick={() => startTransition(retry)}><RefreshCcw className={isPending ? "animate-spin" : ""} />{isPending ? i18n("auto.m0124") : i18n("auto.m0125")}</Button>
  </CardContent></Card>;
}

function Detail({ label, value, mono = false }: {label: string;value: string | null;mono?: boolean;}) {const i18n = useTranslations();return <div><dt className="font-medium text-muted-foreground">{label}</dt><dd className={mono ? "mt-1 whitespace-pre-wrap break-all font-mono" : "mt-1 break-all"}>{value ?? i18n("auto.m0047")}</dd></div>;}
