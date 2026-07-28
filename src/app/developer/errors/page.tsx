import { getTranslations, getLocale } from "next-intl/server";import { AccessDenied, authorizeAccess, PERMISSIONS } from "@/features/access-control";
import { listRecentErrorLogs } from "@/features/error-logs/error-log.repository";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export async function generateMetadata() {const i18n = await getTranslations();return { title: i18n("navigation.items.developer-error-logs") };}


export default async function DeveloperErrorsPage() {const locale = await getLocale(),localeTag = locale === "ja" ? "ja-JP" : "ko-KR";const formatter = new Intl.DateTimeFormat(localeTag, { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Tokyo" });const i18n = await getTranslations();
  const access = await authorizeAccess(PERMISSIONS.DEBUG_READ);
  if (!access.allowed || access.context.role !== "DEVELOPER") return <AccessDenied role={access.context?.role ?? null} />;
  const logs = await listRecentErrorLogs(100);
  return <div className="space-y-4"><PageHeader title={i18n("navigation.items.developer-error-logs")} description={i18n("auto.m0049")} /><Table><TableHeader><TableRow><TableHead>{i18n("auto.m0050")}</TableHead><TableHead>{i18n("auto.m0051")}</TableHead><TableHead>{i18n("technical.route")}</TableHead><TableHead>{i18n("auto.m0052")}</TableHead><TableHead>{i18n("common.details")}</TableHead></TableRow></TableHeader><TableBody>{logs.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-xs">{formatter.format(log.createdAt)}</TableCell><TableCell><Badge variant="outline">{log.errorCode}</Badge><p className="mt-1 font-mono text-xs">{i18n("technical.http")} {log.status}</p></TableCell><TableCell className="max-w-56 break-all text-xs">{log.apiRoute ?? "-"}<br />{log.routeType ?? "-"}</TableCell><TableCell className="max-w-80 break-words text-xs">{log.message}</TableCell><TableCell><details className="max-w-xl text-xs"><summary className="cursor-pointer font-medium">{i18n("auto.m0053")}</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded border p-2">{i18n("technical.errorCode")}: {log.errorCode}{"\n"}{i18n("technical.prismaError")}: {log.prismaError ?? "-"}{"\n"}{i18n("technical.sqlError")}: {log.sqlError ?? "-"}{"\n"}{i18n("technical.stack")}:{"\n"}{log.stack ?? "-"}</pre></details></TableCell></TableRow>)}</TableBody></Table>{!logs.length && <p className="py-12 text-center text-sm text-muted-foreground">{i18n("auto.m0054")}</p>}</div>;
}
