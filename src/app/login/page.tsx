import { getTranslations } from "next-intl/server";import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata() { const i18n = await getTranslations(); return { title: i18n("common.login") }; }

export default async function LoginPage({ searchParams }: {searchParams: Promise<{callbackUrl?: string;sessionReset?: string;}>;}) {const i18n = await getTranslations();
  const { callbackUrl, sessionReset } = await searchParams;
  return <Card className="mx-auto max-w-md"><CardHeader><CardTitle>{i18n("auto.m0057")}</CardTitle></CardHeader><CardContent className="space-y-5">{sessionReset === "1" && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">{i18n("auto.m0058")}</p>}<LoginForm callbackUrl={callbackUrl?.startsWith("/") ? callbackUrl : "/"} /><p className="text-center text-sm text-muted-foreground">{i18n("auto.m0059")}<Link href="/signup" className="font-medium text-primary hover:underline">{i18n("auto.m0060")}</Link></p></CardContent></Card>;
}
