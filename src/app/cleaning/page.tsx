import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";
import { AccessDenied, authorizeAccess, getCurrentAccessContext, PERMISSIONS } from "@/features/access-control";
import { CleaningWorkspace } from "@/features/cleaning/components/cleaning-workspace";
import type { CleaningFilters } from "@/features/cleaning/cleaning.types";
import { parseCleaningDate } from "@/features/cleaning/domain/cleaning-date";
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
  const requestedPage = Number(value(params, "page") ?? "1");
  return {
    tab,
    date: parseCleaningDate(value(params, "date")).dateInput,
    companyId: value(params, "companyId") ?? null,
    propertyId: value(params, "propertyId") ?? null,
    roomId: value(params, "roomId") ?? null,
    assigneeId: value(params, "assigneeId") ?? null,
    status: tab === "history"
      ? "COMPLETED"
      : requestedStatus === "PENDING" || requestedStatus === "IN_PROGRESS" ? requestedStatus : null,
    priority: requestedPriority === "urgent" || requestedPriority === "flexible" ? requestedPriority : null,
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
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <CleaningWorkspace
        filters={{ ...filters, page: data.page }}
        data={data}
        currentUserId={context.userId}
        role={context.role}
      />
    </div>
  );
}
