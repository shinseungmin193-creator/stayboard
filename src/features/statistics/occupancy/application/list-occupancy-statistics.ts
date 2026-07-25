import type { OccupancyPeriod, OccupancyRoom } from "../domain/occupancy";
import { calculateOccupancyMetrics } from "../domain/occupancy";
import { findOccupancyStatisticsRooms } from "../infrastructure/occupancy-statistics.repository";
import { formatRoomDisplayName } from "@/features/rooms/room-display";
import type { AccessScope } from "@/features/access-control";

export interface OccupancyStatisticsFilters { propertyId?: string; query?: string; companyIds?: readonly string[]; accessScope?: AccessScope }
export async function listOccupancyStatistics(filters: OccupancyStatisticsFilters, period: OccupancyPeriod) {
  const rows = await findOccupancyStatisticsRooms({ propertyId: filters.propertyId, companyIds: filters.companyIds, accessScope: filters.accessScope, from: period.start, toExclusive: period.endExclusive });
  const normalizedQuery = filters.query?.trim().toLocaleLowerCase("ko");
  const rooms = rows.filter((row) => !normalizedQuery || `${row.name} ${row.property.name}`.toLocaleLowerCase("ko").includes(normalizedQuery)).map((row): OccupancyRoom => ({ id: row.id, propertyId: row.propertyId, propertyName: row.property.name, name: formatRoomDisplayName(row), sortOrder: row.sortOrder, activeConflictCount: row.conflicts.length, reservations: row.reservations }));
  const metric = calculateOccupancyMetrics(rooms, period);
  const emptyReason = rows.length === 0 ? "NO_ROOMS" : rooms.length === 0 ? "FILTERED" : metric.occupiedNights === 0 && metric.blockedNights === 0 ? "NO_RESERVATIONS" : null;
  return { metric, emptyReason } as const;
}
