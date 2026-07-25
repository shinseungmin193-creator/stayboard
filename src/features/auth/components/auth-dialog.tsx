"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";
import { SignupForm } from "./signup-form";

export type AuthMode = "login" | "signup";

export function AuthDialog({ open, onOpenChange, mode, onModeChange, message }: { open: boolean; onOpenChange: (open: boolean) => void; mode: AuthMode; onModeChange: (mode: AuthMode) => void; message?: string }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="inset-0 top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 content-start overflow-y-auto rounded-none p-5 sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"><DialogHeader><DialogTitle>{mode === "login" ? "StayBoard 로그인" : "StayBoard 무료 시작"}</DialogTitle><DialogDescription>{message ?? (mode === "login" ? "실제 숙소 데이터를 확인하고 운영 기능을 사용하세요." : "새 Company와 관리자 계정을 안전하게 생성합니다.")}</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"><Button type="button" variant={mode === "login" ? "secondary" : "ghost"} onClick={() => onModeChange("login")}>로그인</Button><Button type="button" variant={mode === "signup" ? "secondary" : "ghost"} onClick={() => onModeChange("signup")}>무료 시작</Button></div>{mode === "login" ? <LoginForm onSuccess={() => onOpenChange(false)} /> : <SignupForm onSuccess={() => onOpenChange(false)} />}</DialogContent></Dialog>;
}
