import { Badge } from "@/components/ui/badge";
import { AuthTrigger } from "./auth-trigger";

export function DemoModeBanner() {
  return <div className="border-b bg-primary/5 px-4 py-2 lg:px-7"><div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 text-xs sm:text-sm"><Badge variant="outline">데모 모드</Badge><p className="min-w-0 flex-1 text-muted-foreground">안전한 샘플 데이터가 표시되고 있습니다.</p><AuthTrigger size="sm" variant="outline">로그인</AuthTrigger><AuthTrigger size="sm" mode="signup">무료 시작</AuthTrigger></div></div>;
}
