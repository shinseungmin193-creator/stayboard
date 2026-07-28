import { useTranslations } from "next-intl";import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { type UserRole } from "../domain/access-control";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";

export function AccessDenied({ role }: {role: UserRole | null;}) {const i18n = useTranslations();
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"><ShieldX className="size-6" /></div>
        <h1 className="text-lg font-semibold">{role ? i18n("auto.m0128") : i18n("auto.m0129")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{i18n("auto.m0130")}{role ? i18n(`roles.${role}`) : i18n("auto.m0131")}</p>
        <div className="mt-6 flex gap-2">{!role && <><AuthTrigger>{i18n("common.login")}</AuthTrigger><AuthTrigger mode="signup" variant="outline">{i18n("navigation.freeStart")}</AuthTrigger></>}<Button nativeButton={false} render={<Link href="/" />} variant={role ? "default" : "ghost"}>{i18n("auto.m0133")}</Button></div>
      </CardContent>
    </Card>);

}
