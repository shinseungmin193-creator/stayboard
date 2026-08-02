import "server-only";

import { companyScopeIds, roomScopeWhere, type AccessContext } from "@/features/access-control";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCleaningPhotoStorage } from "../storage/local-file-storage-provider";
import type { CleaningFilters, CleaningPageData, CleaningTaskViewModel } from "../cleaning.types";
import { parseCleaningDate } from "../domain/cleaning-date";
import { classifyCleaningPriority } from "../domain/cleaning-priority";

const PAGE_SIZE = 20;
const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "TENTATIVE"] as const;

export async function listCleaningPage(context: AccessContext, filters: CleaningFilters): Promise<CleaningPageData> {
  const companyIds = companyScopeIds(context);
  const scopeRoomWhere = roomScopeWhere(context.scope);
  const { start, end } = parseCleaningDate(filters.date);
  const sameDayCheckIn: Prisma.ReservationWhereInput = {
    status: { in: [...ACTIVE_RESERVATION_STATUSES] },
    startDate: { gte: start, lt: end },
  };

  const baseAnd: Prisma.CleaningTaskWhereInput[] = [
    scopeRoomWhere ? { room: { is: scopeRoomWhere } } : {},
    filters.companyId ? { companyId: filters.companyId } : {},
    filters.propertyId ? { propertyId: filters.propertyId } : {},
    filters.roomId ? { roomId: filters.roomId } : {},
    filters.assigneeId === "unassigned" ? { assignedToId: null } : filters.assigneeId ? { assignedToId: filters.assigneeId } : {},
  ];
  if (filters.tab === "ongoing" && filters.priority === "urgent") {
    baseAnd.push({ room: { is: { reservations: { some: sameDayCheckIn } } } });
  }
  if (filters.tab === "ongoing" && filters.priority === "flexible") {
    baseAnd.push({ room: { is: { reservations: { none: sameDayCheckIn } } } });
  }

  const where: Prisma.CleaningTaskWhereInput = filters.tab === "history"
    ? {
        AND: baseAnd,
        status: "COMPLETED" as const,
        completedAt: { gte: start, lt: end },
      }
    : {
        AND: baseAnd,
        status: filters.status && filters.status !== "COMPLETED" ? filters.status : { in: ["PENDING", "IN_PROGRESS"] },
        scheduledDate: { gt: start, lte: end },
      };

  const [companies, rooms, memberships, totalCount] = await Promise.all([
    prisma.company.findMany({
      where: { isActive: true, ...(companyIds ? { id: { in: [...companyIds] } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.room.findMany({
      where: { isActive: true, ...(scopeRoomWhere ?? {}) },
      select: { id: true, name: true, propertyId: true, property: { select: { id: true, name: true, companyId: true } } },
      orderBy: [{ property: { name: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.companyMembership.findMany({
      where: {
        status: "ACTIVE",
        ...(companyIds ? { companyId: { in: [...companyIds] } } : {}),
        user: { isActive: true, status: "ACTIVE" },
      },
      select: {
        companyId: true,
        role: true,
        propertyAccesses: { select: { propertyId: true } },
        user: {
          select: {
            id: true,
            name: true,
            assignments: { select: { propertyId: true, roomId: true } },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.cleaningTask.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(filters.page, totalPages);
  const tasks = await prisma.cleaningTask.findMany({
    where,
    select: {
      id: true,
      companyId: true,
      propertyId: true,
      roomId: true,
      scheduledDate: true,
      status: true,
      startedAt: true,
      completedAt: true,
      company: { select: { name: true } },
      property: { select: { name: true } },
      room: {
        select: {
          name: true,
          reservations: {
            where: sameDayCheckIn,
            select: { startDate: true },
            orderBy: { startDate: "asc" },
          },
        },
      },
      reservation: { select: { guestName: true, summary: true, provider: true, endDate: true } },
      assignedTo: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
      photos: {
        select: { id: true, storageKey: true, originalName: true, mimeType: true, size: true, createdAt: true, deleteAfter: true, deletedAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: filters.tab === "history" ? [{ completedAt: "desc" }, { id: "desc" }] : [{ scheduledDate: "asc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const storage = getCleaningPhotoStorage();
  const items: CleaningTaskViewModel[] = tasks.map((task) => {
    const checkInDates = task.room.reservations.map((reservation) => reservation.startDate);
    const eligibleAssignees = memberships
      .filter((membership) => membership.companyId === task.companyId && (
        membership.role === "ADMIN"
        || membership.propertyAccesses.some((access) => access.propertyId === task.propertyId)
        || membership.user.assignments.some((assignment) => assignment.propertyId === task.propertyId || assignment.roomId === task.roomId)
      ))
      .map((membership) => ({ id: membership.user.id, name: membership.user.name }));
    return {
      id: task.id,
      companyId: task.companyId,
      companyName: task.company.name,
      propertyId: task.propertyId,
      propertyName: task.property.name,
      roomId: task.roomId,
      roomName: task.room.name,
      scheduledDate: task.scheduledDate.toISOString(),
      status: task.status,
      priority: classifyCleaningPriority(task.scheduledDate, checkInDates, start, end) ?? "flexible",
      assignedTo: task.assignedTo,
      completedBy: task.completedBy,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      reservation: task.reservation ? {
        guestName: task.reservation.guestName,
        summary: task.reservation.summary,
        provider: task.reservation.provider,
        checkoutAt: task.reservation.endDate.toISOString(),
      } : null,
      nextCheckInAt: checkInDates[0]?.toISOString() ?? null,
      photos: task.photos.map((photo) => ({
        id: photo.id,
        url: photo.storageKey && !photo.deletedAt ? storage.getUrl(photo.storageKey) : null,
        originalName: photo.originalName,
        mimeType: photo.mimeType,
        size: photo.size,
        createdAt: photo.createdAt.toISOString(),
        deleteAfter: photo.deleteAfter?.toISOString() ?? null,
        deletedAt: photo.deletedAt?.toISOString() ?? null,
      })),
      eligibleAssignees,
    };
  });

  const propertyMap = new Map(rooms.map((room) => [room.property.id, room.property]));
  const assigneeMap = new Map(memberships.map((membership) => [membership.user.id, { id: membership.user.id, name: membership.user.name }]));
  return {
    items,
    totalCount,
    totalPages,
    page,
    companies,
    properties: [...propertyMap.values()],
    rooms: rooms.map(({ id, name, propertyId }) => ({ id, name, propertyId })),
    assignees: [...assigneeMap.values()],
  };
}
