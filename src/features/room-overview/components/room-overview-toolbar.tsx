import { useTranslations } from "next-intl";import Link from "next/link";
import { Search } from "lucide-react";
import type { CalendarProviderType, RoomOperationalStatus, SyncStatus } from "@/lib/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ROOM_OVERVIEW_STATUS_PRIORITY, type RoomOverviewStatus } from "../domain/room-overview";
import { getRoomOverviewStatusStyle, type RoomOverviewVisualStatus } from "../room-overview-visuals";
import { RoomOverviewRefresh } from "./room-overview-refresh";
import { RoomOverviewSync } from "./room-overview-sync";
import { cn } from "@/lib/utils";
import styles from "./room-overview-visuals.module.css";
import { CALENDAR_PROVIDER_TYPES } from "@/providers/calendar/types";
import { getProviderLabel } from "@/features/reservations/provider-visuals";

const providers = CALENDAR_PROVIDER_TYPES;
const syncStatuses = ["RUNNING", "SUCCESS", "FAILED", "TIMEOUT"] as const;


interface ToolbarProps {
  properties: Array<{id: string;name: string;isActive: boolean;}>;
  filters: {propertyId?: string;query?: string;status?: RoomOverviewStatus;operationalStatus?: RoomOperationalStatus;provider?: CalendarProviderType;syncStatus?: SyncStatus;};
  summary: {total: number;statuses: Record<RoomOverviewStatus, number>;operationalStatuses: Record<RoomOperationalStatus, number>;};
  currentParams: Array<[string, string]>;
  canSync: boolean;
}

interface SummaryChipProps {
  label: string;
  value: number;
  status?: RoomOverviewVisualStatus;
  active?: boolean;
  href?: string;
  mobile?: boolean;
}

function SummaryChip({ label, value, status, active = false, href, mobile = false }: SummaryChipProps) {
  const className = cn(
    "flex items-center gap-1.5 rounded-md border px-2 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    mobile ? "h-8 px-3 text-xs" : "h-6",
    status ? styles.statusChip : "border-border bg-card",
    active && !status && "border-primary/45 bg-primary/10"
  );
  const style = status ? getRoomOverviewStatusStyle(status) : undefined;
  const content = <><span className="text-muted-foreground">{label}</span><strong className="font-bold tabular-nums text-foreground">{value}</strong></>;

  if (href) return <Link href={href} aria-current={active ? "page" : undefined} data-active={active || undefined} className={className} style={style}>{content}</Link>;
  return <div data-active={active || undefined} className={className} style={style}>{content}</div>;
}

function FilterFields({ properties, filters, showOperational = false }: Pick<ToolbarProps, "properties" | "filters"> & {showOperational?: boolean;}) {const i18n = useTranslations();
  return <>
    <select name="propertyId" defaultValue={filters.propertyId ?? ""} aria-label={i18n("auto.m0078")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0079")}</option>{properties.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    <label className="relative min-w-0"><Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" /><input name="query" defaultValue={filters.query ?? ""} aria-label={i18n("auto.m0492")} placeholder={i18n("auto.m0492")} className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs" /></label>
    <select name="status" defaultValue={filters.status ?? ""} aria-label={i18n("auto.m0493")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0244")}</option>{ROOM_OVERVIEW_STATUS_PRIORITY.map((status) => <option key={status} value={status}>{i18n(`roomStatus.${status}`)}</option>)}</select>
    <select name="provider" defaultValue={filters.provider ?? ""} aria-label={i18n("auto.m0082")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0083")}</option>{providers.map((provider) => <option key={provider} value={provider}>{getProviderLabel(provider, i18n)}</option>)}</select>
    <select name="syncStatus" defaultValue={filters.syncStatus ?? ""} aria-label={i18n("auto.m0494")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0495")}</option>{syncStatuses.map((status) => <option key={status}>{status}</option>)}</select>
    {showOperational && <select name="operationalStatus" defaultValue={filters.operationalStatus ?? ""} aria-label={i18n("auto.m0496")} className="h-8 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">{i18n("auto.m0497")}</option><option value="NONE">{i18n("auto.m0498")}</option><option value="CLEANING_REQUIRED">{i18n("roomStatus.CLEANING_REQUIRED")}</option><option value="INSPECTION_REQUIRED">{i18n("roomStatus.INSPECTION_REQUIRED")}</option></select>}
  </>;
}

export function RoomOverviewToolbar(props: ToolbarProps) {const i18n = useTranslations();const compactStatuses = [{ status: "VACANT", label: i18n("reservation.vacant") }, { status: "OCCUPIED", label: i18n("reservation.statuses.STAYING") }, { status: "CHECK_IN_TODAY", label: i18n("reservation.checkIn") }, { status: "CHECK_OUT_TODAY", label: i18n("reservation.checkOut") }, { status: "CONFLICT", label: i18n("reservation.overbooking") }] as const;
  const statusHref = (status?: RoomOverviewStatus) => {const params = new URLSearchParams(props.currentParams);if (status && status !== props.filters.status) params.set("status", status);else params.delete("status");return `/room-overview${params.size ? `?${params}` : ""}`;};
  const operationalHref = (status: RoomOperationalStatus) => {const params = new URLSearchParams(props.currentParams);if (status !== props.filters.operationalStatus) params.set("operationalStatus", status);else params.delete("operationalStatus");return `/room-overview?${params}`;};
  const mobileSummary: Array<{label: string;value: number;status?: RoomOverviewStatus;}> = [
  { label: i18n("auto.m0102"), value: props.summary.total },
  ...ROOM_OVERVIEW_STATUS_PRIORITY.slice().reverse().map((status) => ({ label: i18n(`roomStatus.${status}`), value: props.summary.statuses[status], status }))];


  return <>
    <div className="space-y-4 xl:hidden">
      <PageHeader eyebrow="ROOM OPERATIONS" title={i18n("navigation.items.room-overview")} description={i18n("auto.m0499")} action={<div className="flex flex-wrap justify-end gap-2">{props.canSync && <RoomOverviewSync propertyId={props.filters.propertyId} />}<RoomOverviewRefresh /></div>} />
      <section aria-label={i18n("auto.m0500")} className="flex flex-wrap gap-2">{mobileSummary.map((item) => <SummaryChip key={item.label} {...item} mobile />)}</section>
      <form method="get" className="grid gap-2 rounded-xl border bg-card p-3 lg:grid-cols-[minmax(140px,1fr)_minmax(180px,1.4fr)_repeat(3,minmax(130px,1fr))_auto]"><FilterFields properties={props.properties} filters={props.filters} /><Button type="submit" variant="outline">{i18n("auto.m0087")}</Button></form>
    </div>
    <section aria-label={i18n("auto.m0501")} className="hidden overflow-hidden rounded-lg border bg-card xl:block">
      <div className="flex h-11 items-center gap-2 border-b px-3">
        <h1 className="mr-1 shrink-0 text-sm font-bold">{i18n("navigation.items.room-overview")}</h1>
        <SummaryChip href={statusHref()} label={i18n("auto.m0102")} value={props.summary.total} active={!props.filters.status} />
        {compactStatuses.map((item) => <SummaryChip key={item.status} href={statusHref(item.status)} label={item.label} value={props.summary.statuses[item.status]} status={item.status} active={props.filters.status === item.status} />)}
        <span className="ml-1 border-l pl-2 text-[10px] text-muted-foreground">{i18n("auto.m0502")}</span>
        {(["CLEANING_REQUIRED", "INSPECTION_REQUIRED"] as const).map((status) => <SummaryChip key={status} href={operationalHref(status)} label={i18n(`roomStatus.${status}`)} value={props.summary.operationalStatuses[status]} status={status} active={props.filters.operationalStatus === status} />)}
        <div className="ml-auto flex items-center gap-2">{props.canSync && <RoomOverviewSync propertyId={props.filters.propertyId} compact />}<RoomOverviewRefresh compact /></div>
      </div>
      <form method="get" className="grid h-11 grid-cols-[140px_minmax(140px,200px)_120px_120px_120px_140px_auto] items-center gap-2 px-3"><FilterFields properties={props.properties} filters={props.filters} showOperational /><Button type="submit" size="sm" variant="outline">{i18n("auto.m0087")}</Button></form>
    </section>
  </>;
}
