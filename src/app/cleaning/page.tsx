import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, getCurrentAccessContext, hasPermission, PERMISSIONS } from "@/features/access-control";
import { CleaningWorkspace } from "@/features/cleaning/components/cleaning-workspace";
import type { CleaningFilters } from "@/features/cleaning/cleaning.types";
import { isCleaningSection } from "@/features/cleaning/domain/cleaning-meta";
import { listCleaningPage } from "@/features/cleaning/server/cleaning.repository";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("cleaning");
  return { title: t("title") };
}

function value(params: Record<string, string | string[] | undefined>, key: string) {
  return typeof params[key] === "string" ? params[key] : undefined;
}

function parseFilters(params: Record<string, string | string[] | undefined>): CleaningFilters {
  const tab = value(params, "tab") === "history" ? "history" : "ongoing";
  const requestedStatus = value(params, "status");
  const requestedPriority = value(params, "priority");
  const requestedSection = value(params, "section");
  const requestedPage = Number(value(params, "page") ?? "1");
  return {
    tab,
    date: value(params, "date") ?? "",
    companyId: value(params, "companyId") ?? null,
    propertyId: value(params, "propertyId") ?? null,
    roomId: value(params, "roomId") ?? null,
    assigneeId: value(params, "assigneeId") ?? null,
    status: tab === "ongoing" && (requestedStatus === "UNASSIGNED"
      || requestedStatus === "WAITING"
      || requestedStatus === "IN_PROGRESS")
      ? requestedStatus
      : null,
    priority: requestedPriority === "urgent" || requestedPriority === "flexible" ? requestedPriority : null,
    unassignedOnly: value(params, "unassignedOnly") === "true",
    section: isCleaningSection(requestedSection) ? requestedSection : "all",
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
}

export default async function CleaningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [context, params, t] = await Promise.all([
    getCurrentAccessContext(),
    searchParams,
    getTranslations("cleaning"),
  ]);
  if (!context) return <AccessDenied role={null} />;
  const access = await authorizeAccess(PERMISSIONS.CLEANING_READ);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const filters = parseFilters(params);
  const data = await listCleaningPage(context, filters);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} action={
        <Link href="/cleaning/stats" className={buttonVariants({ variant: "outline" })}><BarChart3 />{t("stats.open")}</Link>
      } />
      <CleaningWorkspace
        filters={{ ...filters, date: data.date }}
        data={data}
        currentUserId={context.userId}
        currentUserName={context.name ?? ""}
        role={context.role}
        canCreateWorkers={hasPermission(context.role, PERMISSIONS.CLEANING_WORKER_CREATE)}
        canManageWorkers={hasPermission(context.role, PERMISSIONS.CLEANING_WORKER_MANAGE)}
        canCompleteRoomNotes={hasPermission(context.role, PERMISSIONS.ROOM_NOTE_COMPLETE)}
      />
    </div>
  );
}
