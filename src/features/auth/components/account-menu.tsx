"use client";import { useTranslations } from "next-intl";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";
import { cleanupDeveloperRoleSessionForLogoutAction } from "@/features/developer-role-switch/developer-role-switch.actions";

export function AccountLogoutButton() {const i18n = useTranslations();
  const [pending, startTransition] = useTransition();
  return <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { try { await cleanupDeveloperRoleSessionForLogoutAction(); } finally { await signOut({ callbackUrl: withBasePath("/") }); } })}><LogOut />{i18n("auto.m0185")}</Button>;
}
