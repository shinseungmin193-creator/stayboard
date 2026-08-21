"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link2, TriangleAlert } from "lucide-react";
import { INITIAL_ACTION_RESULT } from "@/lib/action-result";
import { ActionMessage } from "@/components/shared/action-message";
import { FieldError } from "@/components/shared/field-error";
import { SubmitButton } from "@/components/shared/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarProviderType } from "@/lib/generated/prisma/enums";
import { getProviderLabel } from "@/features/reservations/provider-visuals";
import { replaceCalendarSourceUrlAction } from "../calendar-source.actions";

export function CalendarSourceUrlReplaceDialog({
  calendarSourceId,
  provider,
  reconnectRequired = false,
  onUpdated,
}: {
  calendarSourceId: string;
  provider: CalendarProviderType;
  reconnectRequired?: boolean;
  onUpdated?: (message: string) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const submitted = useRef(false);
  const [result, action] = useActionState(replaceCalendarSourceUrlAction, INITIAL_ACTION_RESULT);

  useEffect(() => {
    if (!submitted.current || !result.success) return;
    submitted.current = false;
    setOpen(false);
    onUpdated?.(result.message ?? t("calendarSourceEditing.urlSaved"));
    router.refresh();
  }, [onUpdated, result, router, t]);

  const submit = (formData: FormData) => {
    submitted.current = true;
    action(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="min-h-9" variant={reconnectRequired ? "default" : "outline"} />}>
        <Link2 />{t("calendarFeedSafety.replaceAction")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("calendarFeedSafety.replaceTitle")}</DialogTitle>
          <DialogDescription>{t("calendarFeedSafety.replaceDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-5 text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p>{t("calendarFeedSafety.replacePreservesData")}</p>
        </div>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="calendarSourceId" value={calendarSourceId} />
          <div className="flex items-center gap-2 text-sm"><span>{t("technical.provider")}</span><Badge variant="secondary">{getProviderLabel(provider, t)}</Badge></div>
          <div className="space-y-1.5">
            <Label htmlFor={`replace-calendar-url-${calendarSourceId}`}>{t("calendarFeedSafety.latestUrl")}</Label>
            <Input id={`replace-calendar-url-${calendarSourceId}`} name="calendarUrl" type="url" autoComplete="off" maxLength={2000} placeholder="https://…" required />
            <p className="text-xs text-muted-foreground">{t("calendarFeedSafety.replaceValidation")}</p>
            <FieldError errors={!result.success ? result.fieldErrors?.calendarUrl : undefined} />
          </div>
          <ActionMessage result={result} />
          <div className="flex justify-end"><SubmitButton>{t("calendarFeedSafety.validateAndReplace")}</SubmitButton></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
