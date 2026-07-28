"use client";import { useTranslations } from "next-intl";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBasePath } from "@/lib/base-path";
import { verifyInvitationCodeAction } from "@/features/invitation-codes/invitation-code.actions";
import { INVITATION_CODE_MESSAGES, type InvitationLocale } from "@/features/invitation-codes/invitation-code.messages";
import { signupAction } from "../auth.actions";

type SignupType = "new-company" | "invitation-code";
export function SignupForm({ onSuccess, locale = "ko" }: {onSuccess?: () => void;locale?: InvitationLocale;}) {const localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const i18n = useTranslations();
  const [signupType, setSignupType] = useState<SignupType>("new-company");
  const [pending, startTransition] = useTransition();
  const [checking, startChecking] = useTransition();
  const [message, setMessage] = useState<string>();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [codePreview, setCodePreview] = useState<{companyName: string;role: "ADMIN" | "STAFF";expiresAt: string;}>();
  const invitationMessages = INVITATION_CODE_MESSAGES[locale];
  const invitationDateFormatter = new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : localeTag, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" });
  const submit = (formData: FormData) => {
    setMessage(undefined);setErrors({});
    startTransition(async () => {
      const result = await signupAction(formData);
      if (!result.success) {setMessage(result.message);setErrors(result.fieldErrors ?? {});return;}
      const loginEmail = result.data?.email;
      if (!loginEmail) {setMessage(i18n("auto.m0197"));return;}
      const signInResult = await signIn("credentials", { identifier: loginEmail, password: formData.get("password"), redirect: false });
      if (!signInResult?.ok) {setMessage(i18n("auto.m0197"));return;}
      onSuccess?.();window.location.replace(withBasePath(signupType === "new-company" ? "/properties?welcome=1" : "/"));
    });
  };
  const verify = (formData: FormData) => {
    setCodePreview(undefined);setMessage(undefined);
    startChecking(async () => {const result = await verifyInvitationCodeAction(String(formData.get("invitationCode") ?? ""));if (!result.success) setMessage(result.message);else setCodePreview(result.data);});
  };
  const field = (name: string) => errors[name]?.[0];
  return <form action={submit} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="signupType" value={signupType} />
    <fieldset className="grid grid-cols-2 gap-2 sm:col-span-2"><legend className="mb-1.5 text-sm font-medium">{i18n("auto.m0198")}</legend>{([{ value: "new-company", label: i18n("auto.m0199") }, { value: "invitation-code", label: invitationMessages.signupOption }] as const).map((item) => <button key={item.value} type="button" aria-pressed={signupType === item.value} onClick={() => {setSignupType(item.value);setMessage(undefined);setCodePreview(undefined);}} className={`min-h-11 rounded-lg border px-3 text-sm font-medium ${signupType === item.value ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{item.label}</button>)}</fieldset>
    {signupType === "new-company" ? <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="signup-company">{i18n("auto.m0200")}</Label><Input id="signup-company" name="companyName" required /><p className="text-xs text-muted-foreground">{i18n("auto.m0201")}</p>{field("companyName") && <p className="text-xs text-destructive">{field("companyName")}</p>}</div> : <div className="space-y-2 sm:col-span-2"><Label htmlFor="signup-code">{invitationMessages.codeLabel}</Label><div className="flex gap-2"><Input id="signup-code" name="invitationCode" autoCapitalize="characters" autoComplete="off" required onChange={() => setCodePreview(undefined)} placeholder="SB-ADMIN / SB-STAFF" /><Button type="submit" formAction={verify} variant="outline" disabled={checking}>{checking ? <LoaderCircle className="animate-spin" /> : invitationMessages.verify}</Button></div>{field("invitationCode") && <p className="text-xs text-destructive">{field("invitationCode")}</p>}{codePreview && <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"><p className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" />{invitationMessages.verified}</p><p className="mt-1">{invitationMessages.company}: {codePreview.companyName}</p><p>{invitationMessages.role}: {codePreview.role === "ADMIN" ? invitationMessages.admin : invitationMessages.staff}</p><p>{invitationMessages.expiresAt}: {invitationDateFormatter.format(new Date(codePreview.expiresAt))}</p></div>}</div>}
    <div className="space-y-1.5"><Label htmlFor="signup-name">{i18n("auto.m0202")}</Label><Input id="signup-name" name="name" autoComplete="name" required />{field("name") && <p className="text-xs text-destructive">{field("name")}</p>}</div>
    <div className="space-y-1.5"><Label htmlFor="signup-email">{i18n("auto.m0203")}</Label><Input id="signup-email" name="email" type="email" autoComplete="email" required />{field("email") && <p className="text-xs text-destructive">{field("email")}</p>}</div>
    <div className="space-y-1.5"><Label htmlFor="signup-password">{i18n("auto.m0195")}</Label><Input id="signup-password" name="password" type="password" autoComplete="new-password" minLength={8} required />{field("password") && <p className="text-xs text-destructive">{field("password")}</p>}</div>
    <div className="space-y-1.5"><Label htmlFor="signup-password-confirm">{i18n("auto.m0204")}</Label><Input id="signup-password-confirm" name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required />{field("passwordConfirm") && <p className="text-xs text-destructive">{field("passwordConfirm")}</p>}</div>
    {message && <p role="alert" className="text-sm text-destructive sm:col-span-2">{message}</p>}
    <Button type="submit" className="w-full sm:col-span-2" disabled={pending}>{pending && <LoaderCircle className="animate-spin" />}{signupType === "new-company" ? i18n("auto.m0060") : invitationMessages.signupSubmit}</Button>
  </form>;
}
