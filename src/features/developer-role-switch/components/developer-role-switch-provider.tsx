"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearStaleDeveloperRoleSessionCookieAction } from "../developer-role-switch.actions";
import type { ActiveDeveloperRoleSwitch, DeveloperRoleSwitchOptions, DeveloperRoleSwitchRole } from "../domain/developer-role-switch.types";
import { DeveloperRoleSwitchForm } from "./developer-role-switch-form";

interface DeveloperRoleSwitchContextValue {
  available: boolean;
  enabled: boolean;
  active: ActiveDeveloperRoleSwitch | null;
  currentCompanyName: string | null;
  open(role?: DeveloperRoleSwitchRole): void;
}

const DeveloperRoleSwitchContext = createContext<DeveloperRoleSwitchContextValue | null>(null);

export function DeveloperRoleSwitchProvider({
  children,
  available,
  options,
  active,
  currentCompanyName,
  staleCookie,
}: {
  children: ReactNode;
  available: boolean;
  options: DeveloperRoleSwitchOptions | null;
  active: ActiveDeveloperRoleSwitch | null;
  currentCompanyName: string | null;
  staleCookie: boolean;
}) {
  const t = useTranslations("developerRoleSwitch");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [requestedRole, setRequestedRole] = useState<DeveloperRoleSwitchRole | null>(null);
  const [dialogVersion, setDialogVersion] = useState(0);
  useEffect(() => {
    if (staleCookie) void clearStaleDeveloperRoleSessionCookieAction();
  }, [staleCookie]);
  const value = useMemo<DeveloperRoleSwitchContextValue>(() => ({
    available,
    enabled: Boolean(options),
    active,
    currentCompanyName,
    open: (role) => {
      setRequestedRole(role ?? null);
      setDialogVersion((version) => version + 1);
      setOpen(true);
    },
  }), [active, available, currentCompanyName, options]);
  return <DeveloperRoleSwitchContext.Provider value={value}>
    {children}
    {options && <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="size-5" />{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <DeveloperRoleSwitchForm
          key={dialogVersion}
          options={options}
          active={active}
          initialRole={requestedRole ?? active?.previewRole}
          roleLocked={requestedRole !== null}
          onCancel={() => setOpen(false)}
          onSuccess={(path) => { setOpen(false); router.push(path); router.refresh(); }}
        />
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
  return <Button type="button" {...props} onClick={() => context.open()}><ShieldCheck />{children ?? t("title")}</Button>;
}
