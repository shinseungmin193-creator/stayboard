"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import { safeInternalAuthPath } from "../domain/auth-navigation";

export function LoginForm({ callbackUrl = "/", onSuccess }: { callbackUrl?: string; onSuccess?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const submit = (formData: FormData) => {
    setError(undefined);
    startTransition(async () => {
      const result = await signIn("credentials", { identifier: formData.get("identifier"), password: formData.get("password"), redirect: false, callbackUrl });
      if (!result?.ok) {
        setError(result?.error === "ACCOUNT_DISABLED" ? "비활성화된 계정입니다. 관리자에게 문의하세요." : "아이디·이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      onSuccess?.();
      window.location.replace(withBasePath(safeInternalAuthPath(callbackUrl)));
    });
  };
  return <form action={submit} className="space-y-4"><div className="space-y-1.5"><Label htmlFor="login-identifier">아이디 또는 이메일</Label><Input id="login-identifier" name="identifier" type="text" autoComplete="username" required /></div><div className="space-y-1.5"><Label htmlFor="login-password">비밀번호</Label><Input id="login-password" name="password" type="password" autoComplete="current-password" required minLength={8} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" className="w-full" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}로그인</Button><Link href="/api/auth/session-reset" className="block text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">저장된 로그인 세션 초기화</Link></form>;
}
