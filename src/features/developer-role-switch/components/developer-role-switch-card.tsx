"use client";

import { useState, useTransition } from "react";
import { Code2, RotateCcw, ShieldCheck, TriangleAlert, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { endDeveloperRoleSessionAction } from "../developer-role-switch.actions";
import type { DeveloperRoleSwitchRole } from "../domain/developer-role-switch.types";
import { useDeveloperRoleSwitch } from "./developer-role-switch-provider";

type DisplayMode = "DEVELOPER" | DeveloperRoleSwitchRole;

export function DeveloperRoleSwitchCard() {
  const t = useTranslations("developerRoleSwitch");
  const router = useRouter();
  const { available, enabled, active, currentCompanyName, open } = useDeveloperRoleSwitch();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!available) return null;

  const currentMode: DisplayMode = active?.previewRole ?? "DEVELOPER";
  const modeLabel = currentMode === "DEVELOPER" ? t("developerMode") : t(`modes.${currentMode}`);
  const modeBadgeClass = currentMode === "DEVELOPER"
    ? "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200"
    : currentMode === "ADMIN"
      ? "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
      : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";

  const returnToDeveloper = () => startTransition(async () => {
    setMessage(undefined);
    const result = await endDeveloperRoleSessionAction();
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    router.push(result.data?.redirectPath ?? "/developer/settings");
    router.refresh();
  });

  const modeButton = (mode: DisplayMode, label: string, icon: React.ReactNode) => {
    const selected = currentMode === mode;
    const disabled = pending || (mode === "DEVELOPER" ? !active : !enabled);
    const onClick = mode === "DEVELOPER" ? returnToDeveloper : () => open(mode);
    return <Button
      key={mode}
      type="button"
      variant="outline"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-auto min-h-14 min-w-0 flex-col gap-1 whitespace-normal px-2 py-2 text-center text-xs leading-tight sm:flex-row sm:text-sm",
        selected && mode === "DEVELOPER" && "border-violet-500 bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
        selected && mode === "ADMIN" && "border-sky-500 bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
        selected && mode === "STAFF" && "border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
      )}
    >{icon}<span>{label}</span></Button>;
  };

  return <Card className="border-sky-500/40 bg-sky-500/5">
    <CardHeader className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" />{t("modeTitle")}</CardTitle>
        <Badge variant="outline" className={modeBadgeClass}>{t("card.currentModeValue", { mode: modeLabel })}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t("card.description")}</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-2 rounded-lg border bg-background/80 p-3 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">{t("card.currentMode")}</span><strong className="ml-2">{modeLabel}</strong></p>
        <p className="truncate"><span className="text-muted-foreground">{t("card.currentCompany")}</span><strong className="ml-2">{active?.companyName ?? currentCompanyName ?? t("card.notSelected")}</strong></p>
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label={t("card.modeButtons")}>
        {modeButton("DEVELOPER", active ? t("actions.return") : t("developerMode"), active ? <RotateCcw className="size-4" /> : <Code2 className="size-4" />)}
        {modeButton("ADMIN", t("modes.ADMIN"), <ShieldCheck className="size-4" />)}
        {modeButton("STAFF", t("modes.STAFF"), <UserRound className="size-4" />)}
      </div>

      {!enabled && <div role="status" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>{t("card.disabled")}<code className="mt-1 block font-mono text-xs">ENABLE_DEVELOPER_ROLE_SWITCH=true</code></p>
      </div>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
    </CardContent>
  </Card>;
}
