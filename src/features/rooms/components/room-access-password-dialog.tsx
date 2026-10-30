"use client";

import { useRef, useState, useTransition } from "react";
import { KeyRound, LoaderCircle, Save } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getRoomAccessPasswordAction, updateRoomAccessPasswordAction } from "../room-access-password.actions";

export function RoomAccessPasswordDialog({
  roomId,
  roomLabel,
  canManage,
  className,
}: {
  roomId: string;
  roomLabel: string;
  canManage: boolean;
  className?: string;
}) {
  const t = useTranslations("roomAccessPassword");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [password, setPassword] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestSequence = useRef(0);

  const reset = () => {
    requestSequence.current += 1;
    setLoading(false);
    setLoaded(false);
    setPassword("");
    setInitialPassword("");
    setError(null);
    setMessage(null);
  };

  const load = async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoaded(false);
    setError(null);
    setMessage(null);
    const result = await getRoomAccessPasswordAction({ roomId });
    if (sequence !== requestSequence.current) return;
    setLoading(false);
    if (!result.success || !result.data) {
      setError(result.message || t("loadFailed"));
      return;
    }
    const value = result.data.password ?? "";
    setPassword(value);
    setInitialPassword(value);
    setLoaded(true);
  };

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) void load();
    else reset();
  };

  const save = () => {
    if (!canManage || pending || loading) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateRoomAccessPasswordAction({ roomId, password });
      if (!result.success) {
        setError(result.fieldErrors?.password?.[0] || result.message || t("saveFailed"));
        return;
      }
      const normalized = password.trim();
      setPassword(normalized);
      setInitialPassword(normalized);
      setMessage(result.message || (normalized ? t("saved") : t("cleared")));
    });
  };

  return <>
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn("h-6 gap-1 px-2 text-[10px] font-semibold", className)}
      onClick={(event) => { event.stopPropagation(); changeOpen(true); }}
      aria-label={`${roomLabel} ${t("button")}`}
    >
      <KeyRound className="size-3" />{t("button")}
    </Button>

    <Dialog open={open} onOpenChange={(next) => { if (!pending) changeOpen(next); }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5" />{t("title", { room: roomLabel })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {loading && <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />{t("loading")}</div>}

        {!loading && loaded && canManage && <div className="space-y-2">
          <Label htmlFor={`room-access-password-${roomId}`}>{t("inputLabel")}</Label>
          <Input
            id={`room-access-password-${roomId}`}
            value={password}
            onChange={(event) => { setPassword(event.target.value); setError(null); setMessage(null); }}
            maxLength={100}
            autoComplete="off"
            disabled={pending}
            className="font-mono text-base tracking-wide"
            placeholder={t("inputPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("clearHint")}</p>
        </div>}

        {!loading && loaded && !canManage && <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t("inputLabel")}</p>
          {password
            ? <p className="rounded-xl border bg-muted/35 px-4 py-4 text-center font-mono text-xl font-bold tracking-widest select-all">{password}</p>
            : <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{t("notRegistered")}</p>}
          <p className="text-xs text-muted-foreground">{t("readOnly")}</p>
        </div>}

        {!loading && !loaded && <div className="space-y-3">
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="button" variant="outline" onClick={() => void load()}>{t("retry")}</Button>
        </div>}
        {loaded && error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {loaded && message && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => changeOpen(false)}>{t("close")}</Button>
          {canManage && loaded && <Button type="button" disabled={pending || password.trim() === initialPassword} onClick={save}>{pending ? <LoaderCircle className="animate-spin" /> : <Save />}{t("save")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
