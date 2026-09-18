"use client";

import { useState } from "react";
import { CheckCircle2, Download, Share, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PwaInstallStatus } from "@/features/pwa/hooks/use-pwa-install";

export function PwaInstallMenuItem({
  status,
  onInstall,
}: {
  status: PwaInstallStatus;
  onInstall: () => Promise<void>;
}) {
  const t = useTranslations("pwaInstall");
  const [guideOpen, setGuideOpen] = useState(false);

  if (status === "CHECKING" || status === "HIDDEN") return null;

  if (status === "INSTALLED") {
    return (
      <div className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-600" />
        <span>{t("runningStandalone")}</span>
      </div>
    );
  }

  if (status === "IOS_GUIDE") {
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full justify-start gap-3 px-3"
          onClick={() => setGuideOpen(true)}
        >
          <Smartphone className="size-4" />
          {t("addToHome")}
        </Button>
        <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("iosTitle")}</DialogTitle>
              <DialogDescription>{t("iosDescription")}</DialogDescription>
            </DialogHeader>
            <ol className="space-y-3 rounded-xl border bg-muted/40 p-4">
              <li className="flex items-start gap-3">
                <Share className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>{t("iosShareStep")}</span>
              </li>
              <li className="flex items-start gap-3">
                <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>{t("iosAddStep")}</span>
              </li>
            </ol>
            <DialogFooter>
              <Button type="button" onClick={() => setGuideOpen(false)}>{t("confirm")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="min-h-11 w-full justify-start gap-3 px-3"
      disabled={status === "PROMPTING"}
      onClick={() => void onInstall()}
    >
      <Download className="size-4" />
      {status === "PROMPTING" ? t("installing") : t("addToHome")}
    </Button>
  );
}
