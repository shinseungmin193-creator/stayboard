"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDeveloperRoleSwitch } from "./developer-role-switch-provider";

export function DeveloperRoleSwitchCard() {
  const t = useTranslations("developerRoleSwitch");
  const { enabled, active, open } = useDeveloperRoleSwitch();
  if (!enabled) return null;
  return <Card className="border-sky-500/40 bg-sky-500/5">
    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" />{t("title")}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("card.description")}</p>
      <div className="grid gap-2 rounded-lg border bg-background/80 p-3 text-sm sm:grid-cols-3">
        <p><span className="text-muted-foreground">{t("card.actualRole")}</span><strong className="ml-2">{t("developerMode")}</strong></p>
        <p><span className="text-muted-foreground">{t("card.currentMode")}</span><strong className="ml-2">{active ? t(`roles.${active.previewRole}.title`) : t("developerMode")}</strong></p>
        <p className="truncate"><span className="text-muted-foreground">{t("fields.company")}</span><strong className="ml-2">{active?.companyName ?? t("card.notSelected")}</strong></p>
      </div>
      <Button type="button" onClick={open}><ShieldCheck />{active ? t("actions.settings") : t("actions.open")}</Button>
    </CardContent>
  </Card>;
}
