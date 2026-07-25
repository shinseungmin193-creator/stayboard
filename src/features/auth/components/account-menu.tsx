"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { withBasePath } from "@/lib/base-path";

export function AccountLogoutButton() {
  return <Button type="button" variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: withBasePath("/") })}><LogOut />로그아웃</Button>;
}
