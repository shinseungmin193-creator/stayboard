"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearStaleDeveloperRoleSessionCookieAction } from "../developer-role-switch.actions";
import type { ActiveDeveloperRoleSwitch, DeveloperRoleSwitchOptions } from "../domain/developer-role-switch.types";
import { DeveloperRoleSwitchForm } from "./developer-role-switch-form";

interface DeveloperRoleSwitchContextValue {
  enabled: boolean;
  active: ActiveDeveloperRoleSwitch | null;
  open(): void;
}

const DeveloperRoleSwitchContext = createContext<DeveloperRoleSwitchContextValue | null>(null);

export function DeveloperRoleSwitchProvider({
  children,
  options,
  active,
  staleCookie,
}: {
  children: ReactNode;
  options: DeveloperRoleSwitchOptions | null;
  active: ActiveDeveloperRoleSwitch | null;
  staleCookie: boolean;
}) {
  const t = useTranslations("developerRoleSwitch");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (staleCookie) void clearStaleDeveloperRoleSessionCookieAction();
  }, [staleCookie]);
  const value = useMemo<DeveloperRoleSwitchContextValue>(() => ({ enabled: Boolean(options), active, open: () => setOpen(true) }), [active, options]);
  return <DeveloperRoleSwitchContext.Provider value={value}>
    {children}
    {options && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DeveloperRoleSwitchForm options={options} active={active} onSuccess={(path) => { setOpen(false); router.push(path); router.refresh(); }} />
      </DialogContent>
    </Dialog>}
  </DeveloperRoleSwitchContext.Provider>;
}

export function useDeveloperRoleSwitch() {
  const context = useContext(DeveloperRoleSwitchContext);
  if (!context) throw new Error("DeveloperRoleSwitchProvider is required.");
  return context;
}

export function DeveloperRoleSwitchTrigger({
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick">) {
  const t = useTranslations("developerRoleSwitch");
  const context = useDeveloperRoleSwitch();
  if (!context.enabled) return null;
  return <Button type="button" {...props} onClick={context.open}><ShieldCheck />{children ?? t("title")}</Button>;
}
