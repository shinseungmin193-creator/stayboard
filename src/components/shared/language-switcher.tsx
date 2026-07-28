"use client";

import { Globe2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { startTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { isAppLocale, localeCookieName } from "@/i18n/config";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();

  function changeLocale(nextLocale: string) {
    if (!isAppLocale(nextLocale) || nextLocale === locale) return;
    document.cookie = `${localeCookieName}=${nextLocale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = nextLocale;
    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={t("label")} className="gap-1.5">
            <Globe2 className="size-4" />
            <span>{t(locale === "ja" ? "ja" : "ko")}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => changeLocale("ko")}>{t("ko")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLocale("ja")}>{t("ja")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
