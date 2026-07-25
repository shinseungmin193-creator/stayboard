import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "로그인" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; sessionReset?: string }> }) {
  const { callbackUrl, sessionReset } = await searchParams;
  return <Card className="mx-auto max-w-md"><CardHeader><CardTitle>StayBoard 로그인</CardTitle></CardHeader><CardContent className="space-y-5">{sessionReset === "1" && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground">저장된 로그인 세션을 초기화했습니다. 다시 로그인해 주세요.</p>}<LoginForm callbackUrl={callbackUrl?.startsWith("/") ? callbackUrl : "/"} /><p className="text-center text-sm text-muted-foreground">계정이 없나요? <Link href="/signup" className="font-medium text-primary hover:underline">무료로 시작</Link></p></CardContent></Card>;
}
