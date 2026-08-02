"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Settings2, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { endDeveloperRoleSessionAction } from "../developer-role-switch.actions";
import { useDeveloperRoleSwitch } from "./developer-role-switch-provider";

export function DeveloperRoleSwitchBanner() {
  const t = useTranslations("developerRoleSwitch");
  const router = useRouter();
  const { active, open } = useDeveloperRoleSwitch();
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!active) return null;
  const end = () => startTransition(async () => {
    setMessage(undefined);
    const result = await endDeveloperRoleSessionAction();
    if (!result.success) {
      setMessage(result.message);
      return;
    }
    router.push(result.data?.redirectPath ?? "/");
    router.refresh();
  });
  return <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 border-b border-amber-300/70 bg-amber-50/95 px-3 py-2 text-amber-950 shadow-sm backdrop-blur dark:border-amber-800 dark:bg-amber-950/95 dark:text-amber-100 lg:top-16 lg:ml-0">
    <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-1">
      <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm"><ShieldCheck className="size-4" />{t(`banner.${active.previewRole}`)}</span>
      <span className="min-w-0 truncate text-xs">{t("banner.company", { company: active.companyName })}</span>
      {active.previewRole === "STAFF" && <span className="text-xs">{t("banner.properties", { count: active.allowedPropertyIds.length })}</span>}
      <div className="ml-auto flex items-center gap-1">
        <Button type="button" size="xs" variant="outline" className="border-amber-400 bg-background/80" onClick={open}><Settings2 />{t("actions.settings")}</Button>
        <Button type="button" size="xs" className="bg-amber-900 text-white hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950" disabled={pending} onClick={end}><RotateCcw />{pending ? t("actions.processing") : t("actions.return")}</Button>
      </div>
      {message && <span role="alert" className="w-full text-xs text-destructive">{message}</span>}
    </div>
  </div>;
}
