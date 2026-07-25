"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuthDialog } from "./auth-dialog-provider";
import type { AuthMode } from "./auth-dialog";

export function AuthTrigger({ mode = "login", message, children, ...props }: Omit<ComponentProps<typeof Button>, "onClick"> & { mode?: AuthMode; message?: string; children: ReactNode }) {
  const { openAuth } = useAuthDialog();
  return <Button type="button" onClick={() => openAuth(mode, message)} {...props}>{children}</Button>;
}
