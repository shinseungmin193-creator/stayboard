import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { AccessDenied, authorizeAccess, hasPermission, PERMISSIONS } from "@/features/access-control";
import { RoomNoteCreateDialog } from "@/features/room-notes/components/room-note-create-dialog";
import { RoomNoteFilterBar } from "@/features/room-notes/components/room-note-filter-bar";
import { RoomNoteList } from "@/features/room-notes/components/room-note-list";
import { listRoomNoteOptions, listRoomNotes, normalizeRoomNoteSelection, type RoomNoteFilters } from "@/features/room-notes";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("roomNotes");
  return { title: t("title") };
}

function value(params: Record<string, string | string[] | undefined>, key: string) {
  return typeof params[key] === "string" ? params[key] : null;
}

export default async function RoomNotesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [access, params, t] = await Promise.all([
    authorizeAccess(PERMISSIONS.ROOM_NOTE_READ),
    searchParams,
    getTranslations("roomNotes"),
  ]);
  if (!access.allowed) return <AccessDenied role={access.context?.role ?? null} />;
  const options = await listRoomNoteOptions(access.context);
  const selection = normalizeRoomNoteSelection(options.rooms, value(params, "propertyId"), value(params, "roomId"));
  const requestedPage = Number(value(params, "page") ?? "1");
  const filters: RoomNoteFilters = {
    ...selection,
    query: (value(params, "query") ?? "").trim().slice(0, 100),
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  };
  const result = await listRoomNotes(access.context, filters);
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (filters.propertyId) query.set("propertyId", filters.propertyId);
    if (filters.roomId) query.set("roomId", filters.roomId);
    if (filters.query) query.set("query", filters.query);
    if (page > 1) query.set("page", String(page));
    return query.size ? `/room-notes?${query}` : "/room-notes";
  };

  return <div className="space-y-4">
    <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} action={hasPermission(access.context.role, PERMISSIONS.ROOM_NOTE_CREATE) ? <RoomNoteCreateDialog options={options} /> : undefined} />
    <RoomNoteFilterBar filters={filters} options={options} />
    <div className="flex min-h-7 items-center justify-between gap-3"><p className="text-sm font-semibold">{t("count", { count: result.totalCount })}</p><p className="text-xs text-muted-foreground">{result.page} / {result.totalPages}</p></div>
    <RoomNoteList notes={result.items} />
    {result.totalPages > 1 && <nav className="flex justify-end gap-2" aria-label={t("pagination.label")}><Button nativeButton={false} render={<Link href={pageHref(Math.max(1, result.page - 1))} />} variant="outline" disabled={result.page <= 1}>{t("pagination.previous")}</Button><Button nativeButton={false} render={<Link href={pageHref(Math.min(result.totalPages, result.page + 1))} />} variant="outline" disabled={result.page >= result.totalPages}>{t("pagination.next")}</Button></nav>}
  </div>;
}
