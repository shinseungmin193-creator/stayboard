"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { withBasePath } from "@/lib/base-path";

export function AuthProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  return (
    <SessionProvider
      basePath={withBasePath("/api/auth")}
      refetchOnWindowFocus={false}
      session={session}
    >
      {children}
    </SessionProvider>
  );
}
