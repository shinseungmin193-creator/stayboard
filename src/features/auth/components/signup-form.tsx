"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupAction } from "../auth.actions";

export function SignupForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const submit = (formData: FormData) => {
    setMessage(undefined);
    setErrors({});
    startTransition(async () => {
      const result = await signupAction(formData);
      if (!result.success) {
        setMessage(result.message);
        setErrors(result.fieldErrors ?? {});
        return;
      }
      const signInResult = await signIn("credentials", { identifier: formData.get("email"), password: formData.get("password"), redirect: false });
      if (!signInResult?.ok) {
        setMessage("계정이 생성되었습니다. 로그인 탭에서 로그인해 주세요.");
        return;
      }
      onSuccess?.();
      router.push("/properties?welcome=1");
      router.refresh();
    });
  };
  const field = (name: string) => errors[name]?.[0];
  return <form action={submit} className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="signup-company">회사명</Label><Input id="signup-company" name="companyName" required /><p className="text-xs text-muted-foreground">가입자 전용 새 Company가 생성됩니다.</p>{field("companyName") && <p className="text-xs text-destructive">{field("companyName")}</p>}</div><div className="space-y-1.5"><Label htmlFor="signup-name">이름</Label><Input id="signup-name" name="name" autoComplete="name" required />{field("name") && <p className="text-xs text-destructive">{field("name")}</p>}</div><div className="space-y-1.5"><Label htmlFor="signup-email">이메일</Label><Input id="signup-email" name="email" type="email" autoComplete="email" required />{field("email") && <p className="text-xs text-destructive">{field("email")}</p>}</div><div className="space-y-1.5"><Label htmlFor="signup-password">비밀번호</Label><Input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={8} required />{field("password") && <p className="text-xs text-destructive">{field("password")}</p>}</div><div className="space-y-1.5"><Label htmlFor="signup-password-confirm">비밀번호 확인</Label><Input id="signup-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />{field("passwordConfirm") && <p className="text-xs text-destructive">{field("passwordConfirm")}</p>}</div>{message && <p role="alert" className="text-sm text-destructive sm:col-span-2">{message}</p>}<Button type="submit" className="w-full sm:col-span-2" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}무료로 시작</Button><p className="text-xs text-muted-foreground sm:col-span-2">공개 가입은 새 회사의 관리자 계정만 생성합니다. 직원 계정은 관리자가 생성합니다.</p></form>;
}
