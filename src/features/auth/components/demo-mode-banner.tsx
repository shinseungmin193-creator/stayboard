import { Badge } from "@/components/ui/badge";
import { AuthTrigger } from "./auth-trigger";

export function DemoModeBanner() {
  return <div className="border-b bg-primary/5 px-3 py-2.5 sm:px-4 lg:px-7"><div className="mx-auto grid max-w-[1500px] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 text-xs sm:flex sm:text-sm"><Badge variant="outline">데모 모드</Badge><p className="min-w-0 leading-4 text-muted-foreground">안전한 샘플 데이터가 표시되고 있습니다.</p><div className="col-span-2 grid grid-cols-2 gap-2 sm:ml-auto sm:flex"><AuthTrigger size="sm" variant="outline">로그인</AuthTrigger><AuthTrigger size="sm" mode="signup">무료 시작</AuthTrigger></div></div></div>;
}
