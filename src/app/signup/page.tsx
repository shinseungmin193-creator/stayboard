import { getTranslations } from "next-intl/server";import Link from "next/link";
import { headers } from "next/headers";
import { SignupForm } from "@/features/auth/components/signup-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/features/auth";
import { InvitationCodeAcceptance } from "@/features/invitation-codes/components/invitation-code-acceptance";
import { INVITATION_CODE_MESSAGES, resolveInvitationLocale } from "@/features/invitation-codes/invitation-code.messages";

export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("navigation.freeStart") }; }

export default async function SignupPage() {const i18n = await getTranslations();
  const [user, requestHeaders] = await Promise.all([getCurrentUser(), headers()]);
  const locale = resolveInvitationLocale(requestHeaders.get("accept-language"));
  const invitationMessages = INVITATION_CODE_MESSAGES[locale];
  if (user) {
    return <Card className="mx-auto max-w-xl"><CardHeader><CardTitle>{invitationMessages.acceptTitle}</CardTitle><p className="text-sm text-muted-foreground">{invitationMessages.acceptDescription}</p></CardHeader><CardContent><InvitationCodeAcceptance locale={locale} /></CardContent></Card>;
  }
  return <Card className="mx-auto max-w-xl"><CardHeader><CardTitle>{i18n("auto.m0117")}</CardTitle></CardHeader><CardContent className="space-y-5"><SignupForm locale={locale} /><p className="text-center text-sm text-muted-foreground">{i18n("auto.m0118")}<Link href="/login" className="font-medium text-primary hover:underline">{i18n("common.login")}</Link></p></CardContent></Card>;
}
