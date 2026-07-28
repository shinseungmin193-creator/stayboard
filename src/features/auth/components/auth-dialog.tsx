"use client";import { useTranslations } from "next-intl";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

export type AuthMode = "login" | "signup";

export function AuthDialog({ open, onOpenChange, mode, onModeChange, message }: {open: boolean;onOpenChange: (open: boolean) => void;mode: AuthMode;onModeChange: (mode: AuthMode) => void;message?: string;}) {const i18n = useTranslations();
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="inset-0 top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-5 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"><DialogHeader><DialogTitle>{mode === "login" ? i18n("auto.m0057") : i18n("auto.m0117")}</DialogTitle><DialogDescription>{message ?? (mode === "login" ? i18n("auto.m0187") : i18n("auto.m0188"))}</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"><Button type="button" variant={mode === "login" ? "secondary" : "ghost"} onClick={() => onModeChange("login")}>{i18n("common.login")}</Button><Button type="button" variant={mode === "signup" ? "secondary" : "ghost"} onClick={() => onModeChange("signup")}>{i18n("navigation.freeStart")}</Button></div>{mode === "login" ? <LoginForm onSuccess={() => onOpenChange(false)} /> : <SignupForm onSuccess={() => onOpenChange(false)} />}</DialogContent></Dialog>;
}
