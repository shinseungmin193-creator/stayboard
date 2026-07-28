"use client";import { useTranslations } from "next-intl";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

export function AccountLogoutButton() {const i18n = useTranslations();
  return <Button type="button" variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: withBasePath("/") })}><LogOut />{i18n("auto.m0185")}</Button>;
}
