import { AccessDenied, authorizeAccess, PERMISSIONS } from "@/features/access-control";
import { listRecentErrorLogs } from "@/features/error-logs/error-log.repository";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata = { title: "오류 로그" };
const formatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tokyo" });

export default async function DeveloperErrorsPage() {
  const access = await authorizeAccess(PERMISSIONS.DEBUG_READ);
  if (!access.allowed || access.context.role !== "DEVELOPER") return <AccessDenied role={access.context?.role ?? null} />;
  const logs = await listRecentErrorLogs(100);
  return <div className="space-y-4"><PageHeader title="오류 로그" description="서버 렌더링, API 및 Server Action에서 수집된 최근 오류 100건입니다." /><Table><TableHeader><TableRow><TableHead>발생 시각</TableHead><TableHead>코드</TableHead><TableHead>Route</TableHead><TableHead>원본 오류</TableHead><TableHead>상세</TableHead></TableRow></TableHeader><TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-xs">{formatter.format(log.createdAt)}</TableCell><TableCell><Badge variant="outline">{log.errorCode}</Badge><p className="mt-1 font-mono text-xs">HTTP {log.status}</p></TableCell><TableCell className="max-w-56 break-all text-xs">{log.apiRoute ?? "-"}<br />{log.routeType ?? "-"}</TableCell><TableCell className="max-w-80 break-words text-xs">{log.message}</TableCell><TableCell><details className="max-w-xl text-xs"><summary className="cursor-pointer font-medium">오류 상세 보기</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded border p-2">Error Code: {log.errorCode}{"\n"}Prisma Error: {log.prismaError ?? "-"}{"\n"}SQL Error: {log.sqlError ?? "-"}{"\n"}Stack:{"\n"}{log.stack ?? "-"}</pre></details></TableCell></TableRow>)}</TableBody></Table>{!logs.length && <p className="py-12 text-center text-sm text-muted-foreground">저장된 오류가 없습니다.</p>}</div>;
}
