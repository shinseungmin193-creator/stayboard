"use client";import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import { safeInternalAuthPath } from "../domain/auth-navigation";

export function LoginForm({ callbackUrl = "/", onSuccess }: {callbackUrl?: string;onSuccess?: () => void;}) {const i18n = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const submit = (formData: FormData) => {
    setError(undefined);
    startTransition(async () => {
      const result = await signIn("credentials", { identifier: formData.get("identifier"), password: formData.get("password"), redirect: false, callbackUrl });
      if (!result?.ok) {
        setError(i18n("auto.m0193"));
        return;
      }
      onSuccess?.();
      window.location.replace(withBasePath(safeInternalAuthPath(callbackUrl)));
    });
  };
  return <form action={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="login-identifier">{i18n("auto.m0194")}</Label><Input id="login-identifier" name="identifier" type="text" autoComplete="username" required /></div><div className="space-y-1.5"><Label htmlFor="login-password">{i18n("auto.m0195")}</Label><Input id="login-password" name="password" type="password" autoComplete="current-password" required minLength={8} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{i18n("common.login")}</Button><Link href="/api/auth/session-reset" className="block text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{i18n("auto.m0196")}</Link></form>;
}
