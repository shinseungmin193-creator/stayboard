"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { AuthDialog, type AuthMode } from "./auth-dialog";

interface AuthDialogContextValue {
  openAuth: (mode?: AuthMode, message?: string) => void;
}

const AuthDialogContext = createContext<AuthDialogContextValue | null>(null);

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState<string>();
  const openAuth = (nextMode: AuthMode = "login", nextMessage?: string) => {
    setMode(nextMode);
    setMessage(nextMessage);
    setOpen(true);
  };
  return <AuthDialogContext.Provider value={{ openAuth }}>{children}<AuthDialog open={open} onOpenChange={setOpen} mode={mode} onModeChange={setMode} message={message} /></AuthDialogContext.Provider>;
}

export function useAuthDialog() {
  const value = useContext(AuthDialogContext);
  if (!value) throw new Error("AuthDialogProvider 안에서 사용해야 합니다.");
  return value;
}
