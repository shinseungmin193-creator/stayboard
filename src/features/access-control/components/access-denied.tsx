import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { USER_ROLE_LABELS, type UserRole } from "../domain/access-control";
import { AuthTrigger } from "@/features/auth/components/auth-trigger";

export function AccessDenied({ role }: { role: UserRole | null }) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive"><ShieldX className="size-6" /></div>
        <h1 className="text-lg font-semibold">{role ? "이 페이지에 접근할 권한이 없습니다." : "이 기능은 로그인 후 사용할 수 있습니다."}</h1>
        <p className="mt-2 text-sm text-muted-foreground">현재 역할: {role ? USER_ROLE_LABELS[role] : "게스트"}</p>
        <div className="mt-6 flex gap-2">{!role && <><AuthTrigger>로그인</AuthTrigger><AuthTrigger mode="signup" variant="outline">무료 시작</AuthTrigger></>}<Button nativeButton={false} render={<Link href="/" />} variant={role ? "default" : "ghost"}>대시보드로 돌아가기</Button></div>
      </CardContent>
    </Card>
  );
}
