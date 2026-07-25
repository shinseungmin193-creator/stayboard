"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function AccountLogoutButton() {
  return <Button type="button" variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}><LogOut />로그아웃</Button>;
}
