import "server-only";

import { companyScopeIds, propertyScopeWhere, roomScopeWhere, type AccessContext } from "@/features/access-control";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CleaningAssigneeAccount,
  CleaningFilters,
  CleaningPageData,
  CleaningSectionData,
  CleaningStatusFilter,
  CleaningTaskViewModel,
} from "../cleaning.types";
import { getCleaningDateInput, parseCleaningDate } from "../domain/cleaning-date";
import { buildCompletedCleaningHistoryWhere } from "../domain/cleaning-history";
import { CLEANING_SECTIONS, getCleaningListStatusesForDate, type CleaningSection } from "../domain/cleaning-meta";
import { classifyCleaningPriority } from "../domain/cleaning-priority";
import { isCleaningPhotoRetentionExpired } from "../domain/cleaning-retention";
import { getCleaningPhotoStorage } from "../storage/local-file-storage-provider";
import { buildOperationalReservationWhere } from "@/features/reservations/operational-reservation-where";
import { listOpenRoomNotesForRooms } from "@/features/room-notes";
import { listCleaningWorkers } from "./cleaning-worker.repository";
import {
  buildSelectedDateCleaningTaskWhere,
  isCleaningTaskAlignedWithReservation,
} from "./cleaning-task-query";

const SECTION_PAGE_SIZE = 20;
const SECTION_PREVIEW_SIZE = 8;

async function resolveCleaningTimeZone(context: AccessContext, filters: CleaningFilters) {
  const roomWhere = roomScopeWhere(context.scope);
  if (filters.roomId) {
    const room = await prisma.room.findFirst({
      where: { id: filters.roomId, ...(roomWhere ?? {}) },
      select: { property: { select: { timezone: true } } },
    });
    if (room) return room.property.timezone;
  }
  if (filters.propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: filters.propertyId, ...(propertyScopeWhere(context.scope) ?? {}) },
      select: { timezone: true },
    });
    if (property) return property.timezone;
  }
  const companyIds = companyScopeIds(context);
  const company = await prisma.company.findFirst({
    where: {
      isActive: true,
      AND: [
        filters.companyId ? { id: filters.companyId } : {},
        companyIds ? { id: { in: [...companyIds] } } : {},
      ],
    },
    select: { settings: { select: { timezone: true } } },
    orderBy: { createdAt: "asc" },
  });
  return company?.settings?.timezone ?? "Asia/Tokyo";
}

function statusWhere(status: CleaningStatusFilter | null): Prisma.CleaningTaskWhereInput {
  if (status === "UNASSIGNED") return { status: "PENDING", assignedToId: null, assigneeName: null };
  if (status === "WAITING") {
    return { status: "PENDING", OR: [{ assignedToId: { not: null } }, { assigneeName: { not: null } }] };
  }
  if (status === "IN_PROGRESS") return { status: "IN_PROGRESS" };
  if (status === "COMPLETED") return { status: "COMPLETED" };
  return {};
}

export async function listCleaningPage(context: AccessContext, filters: CleaningFilters): Promise<CleaningPageData> {
  const companyIds = companyScopeIds(context);
  const scopeRoomWhere = roomScopeWhere(context.scope);
  const referenceAt = new Date();
  const timeZone = await resolveCleaningTimeZone(context, filters);
  const { dateInput, start, end } = parseCleaningDate(filters.date, referenceAt, timeZone);
  const listStatuses = getCleaningListStatusesForDate(dateInput, getCleaningDateInput(referenceAt, timeZone));
  const sameDayCheckIn: Prisma.ReservationWhereInput = {
    ...buildOperationalReservationWhere(),
    startDate: { gte: start, lt: end },
  };
  const sharedAnd: Prisma.CleaningTaskWhereInput[] = [
    scopeRoomWhere ? { room: { is: scopeRoomWhere } } : {},
    { scheduledDate: { gt: start, lte: end } },
    filters.companyId ? { companyId: filters.companyId } : {},
    filters.propertyId ? { propertyId: filters.propertyId } : {},
    filters.roomId ? { roomId: filters.roomId } : {},
    filters.assigneeId === "unassigned"
      ? { assignedToId: null, assigneeName: null }
      : filters.assigneeId
        ? { assignedToId: filters.assigneeId }
        : {},
    filters.unassignedOnly ? { assignedToId: null, assigneeName: null } : {},
  ];
  const priorityWhere = (priority: "urgent" | "flexible"): Prisma.CleaningTaskWhereInput => ({
    room: { is: { reservations: priority === "urgent" ? { some: sameDayCheckIn } : { none: sameDayCheckIn } } },
  });
  const visibleStatus = statusWhere(filters.status);
  const selectedDateCleaningTasks = buildSelectedDateCleaningTaskWhere({
    start,
    end,
    roomWhere: scopeRoomWhere,
    statuses: listStatuses,
  });
  const sectionWhere = (section: CleaningSection): Prisma.CleaningTaskWhereInput => ({
    AND: [
      ...sharedAnd,
      visibleStatus,
      selectedDateCleaningTasks,
      priorityWhere(section),
      filters.priority && filters.priority !== section ? { id: "__hidden_section__" } : {},
    ],
  });
  const summaryBase = { AND: sharedAnd } satisfies Prisma.CleaningTaskWhereInput;
  const historyWhere = buildCompletedCleaningHistoryWhere({
    roomWhere: scopeRoomWhere,
    companyId: filters.companyId,
    propertyId: filters.propertyId,
    roomId: filters.roomId,
    assigneeId: filters.assigneeId,
  });

  const [companies, rooms, memberships, summaryTasks, completedCount, workers] = await Promise.all([
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
        user: { select: { id: true, name: true, assignments: { select: { propertyId: true, roomId: true } } } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.cleaningTask.findMany({
      where: { AND: [summaryBase, selectedDateCleaningTasks] },
      select: {
        scheduledDate: true,
        status: true,
        assignedToId: true,
        assigneeName: true,
        reservation: { select: { endDate: true } },
        room: { select: { reservations: { where: sameDayCheckIn, select: { startDate: true } } } },
      },
    }),
    prisma.cleaningTask.count({ where: { AND: [summaryBase, { status: "COMPLETED" }] } }),
    listCleaningWorkers(context, { includeInactive: true }),
  ]);

  let urgentCount = 0;
  let flexibleCount = 0;
  let unassignedCount = 0;
  for (const task of summaryTasks) {
    if (task.status !== "COMPLETED" && !isCleaningTaskAlignedWithReservation(task)) continue;
    const priority = classifyCleaningPriority(
      task.scheduledDate,
      task.room.reservations.map((reservation) => reservation.startDate),
      start,
      end,
    );
    if (priority === "urgent") urgentCount += 1;
    else if (priority === "flexible") flexibleCount += 1;
    if (task.status === "PENDING" && !task.assignedToId && !task.assigneeName) unassignedCount += 1;
  }

  const taskSelect = {
    id: true,
    companyId: true,
    propertyId: true,
    roomId: true,
    scheduledDate: true,
    status: true,
    assignedToId: true,
    assigneeName: true,
    assignedById: true,
    assignedAt: true,
    startedByName: true,
    startedBy: { select: { name: true } },
    startedAt: true,
    completedById: true,
    completedByName: true,
    cleanerName: true,
    completedAt: true,
    note: true,
    company: { select: { name: true } },
    property: { select: { name: true } },
    room: {
      select: {
        name: true,
        reservations: { where: sameDayCheckIn, select: { startDate: true }, orderBy: { startDate: "asc" as const } },
      },
    },
    reservation: { select: { guestName: true, summary: true, provider: true, endDate: true } },
    assignedTo: { select: { id: true, name: true } },
    completedBy: { select: { id: true, name: true } },
    photos: {
      select: { id: true, storageKey: true, originalName: true, mimeType: true, size: true, createdAt: true, deleteAfter: true, deletedAt: true },
      orderBy: { createdAt: "asc" as const },
      take: 12,
    },
    logs: {
      select: { id: true, action: true, actor: { select: { name: true } }, workerName: true, previousStatus: true, nextStatus: true, createdAt: true },
      orderBy: { createdAt: "desc" as const },
      take: 20,
    },
    _count: { select: { photos: { where: { storageKey: { not: null }, deletedAt: null } } } },
  } satisfies Prisma.CleaningTaskSelect;

  const [visibleUrgentCount, visibleFlexibleCount, historyTotalCount] = await Promise.all([
    prisma.cleaningTask.count({ where: sectionWhere("urgent") }),
    prisma.cleaningTask.count({ where: sectionWhere("flexible") }),
    prisma.cleaningTask.count({ where: historyWhere }),
  ]);
  const counts = { urgent: visibleUrgentCount, flexible: visibleFlexibleCount } satisfies Record<CleaningSection, number>;
  const sectionRows = await Promise.all(CLEANING_SECTIONS.map(async (section) => {
    if (filters.tab === "history") return [];
    if (filters.section !== "all" && filters.section !== section) return [];
    const page = filters.section === section ? Math.min(filters.page, Math.max(1, Math.ceil(counts[section] / SECTION_PAGE_SIZE))) : 1;
    return prisma.cleaningTask.findMany({
      where: sectionWhere(section),
      select: taskSelect,
      orderBy: [{ scheduledDate: "asc" }, { id: "asc" }],
      skip: filters.section === section ? (page - 1) * SECTION_PAGE_SIZE : 0,
      take: filters.section === section ? SECTION_PAGE_SIZE : SECTION_PREVIEW_SIZE,
    });
  }));
  const historyTotalPages = Math.max(1, Math.ceil(historyTotalCount / SECTION_PAGE_SIZE));
  const historyPage = Math.min(filters.page, historyTotalPages);
  const historyRows = filters.tab === "history"
    ? await prisma.cleaningTask.findMany({
        where: historyWhere,
        select: taskSelect,
        orderBy: [{ completedAt: "desc" }, { scheduledDate: "desc" }, { id: "desc" }],
        skip: (historyPage - 1) * SECTION_PAGE_SIZE,
        take: SECTION_PAGE_SIZE,
      })
    : [];

  const visibleRoomIds = [
    ...sectionRows.flatMap((rows) => rows.map((task) => task.roomId)),
    ...historyRows.map((task) => task.roomId),
  ];
  const openRoomNotes = await listOpenRoomNotesForRooms(context, visibleRoomIds);
  const openRoomNotesByRoomId = new Map<string, typeof openRoomNotes>();
  for (const note of openRoomNotes) {
    const notes = openRoomNotesByRoomId.get(note.roomId) ?? [];
    notes.push(note);
    openRoomNotesByRoomId.set(note.roomId, notes);
  }

  const storage = getCleaningPhotoStorage();
  const toViewModel = (task: (typeof sectionRows)[number][number]): CleaningTaskViewModel => {
    const checkInDates = task.room.reservations.map((reservation) => reservation.startDate);
    const eligibleAssignees = memberships
      .filter((membership) => membership.companyId === task.companyId && (
        membership.role === "ADMIN"
        || membership.propertyAccesses.some((access) => access.propertyId === task.propertyId)
        || membership.user.assignments.some((assignment) => assignment.propertyId === task.propertyId || assignment.roomId === task.roomId)
      ))
      .map((membership) => ({
        id: membership.user.id,
        name: membership.user.name,
        role: membership.role,
      } satisfies CleaningAssigneeAccount));
    const assigneeName = task.assigneeName ?? task.assignedTo?.name ?? null;
    const legacyWithoutCleanerSnapshot = task.cleanerName === null;
    const startedByName = (legacyWithoutCleanerSnapshot
      ? task.startedBy?.name ?? task.startedByName
      : task.startedByName ?? task.startedBy?.name) ?? null;
    const completedByName = (legacyWithoutCleanerSnapshot
      ? task.completedBy?.name ?? task.completedByName
      : task.completedByName ?? task.completedBy?.name) ?? null;
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
      assignee: assigneeName ? { userId: task.assignedToId, name: assigneeName, assignedAt: task.assignedAt?.toISOString() ?? null, assignedById: task.assignedById } : null,
      startedByName,
      completedBy: completedByName ? { userId: task.completedById, name: completedByName } : null,
      cleanerName: task.cleanerName,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      note: task.note,
      reservation: task.reservation ? {
        guestName: task.reservation.guestName,
        summary: task.reservation.summary,
        provider: task.reservation.provider,
        checkoutAt: task.reservation.endDate.toISOString(),
      } : null,
      targetAt: checkInDates[0]?.toISOString() ?? null,
      nextCheckInAt: checkInDates[0]?.toISOString() ?? null,
      photoCount: task._count.photos,
      photoRetentionExpired: isCleaningPhotoRetentionExpired(task.completedAt, referenceAt),
      photos: task.photos.map((photo) => ({
        id: photo.id,
        url: photo.storageKey && !photo.deletedAt ? storage.getUrl(photo.id) : null,
        originalName: photo.originalName,
        mimeType: photo.mimeType,
        size: photo.size,
        createdAt: photo.createdAt.toISOString(),
        deleteAfter: photo.deleteAfter?.toISOString() ?? null,
        deletedAt: photo.deletedAt?.toISOString() ?? null,
      })),
      logs: task.logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorName: log.actor?.name ?? null,
        workerName: log.workerName,
        previousStatus: log.previousStatus,
        nextStatus: log.nextStatus,
        createdAt: log.createdAt.toISOString(),
      })),
      eligibleAssignees,
      openRoomNotes: openRoomNotesByRoomId.get(task.roomId) ?? [],
    };
  };
  const sectionData = Object.fromEntries(CLEANING_SECTIONS.map((section, index) => {
    const totalCount = counts[section];
    const totalPages = Math.max(1, Math.ceil(totalCount / SECTION_PAGE_SIZE));
    const page = filters.section === section ? Math.min(filters.page, totalPages) : 1;
    return [section, { items: sectionRows[index].map(toViewModel), totalCount, totalPages, page } satisfies CleaningSectionData];
  })) as Record<CleaningSection, CleaningSectionData>;
  const history = {
    items: historyRows.map(toViewModel),
    totalCount: historyTotalCount,
    totalPages: historyTotalPages,
    page: historyPage,
  } satisfies CleaningSectionData;

  const propertyMap = new Map(rooms.map((room) => [room.property.id, room.property]));
  const assigneeMap = new Map(memberships.map((membership) => [membership.user.id, {
    id: membership.user.id,
    name: membership.user.name,
    role: membership.role,
  } satisfies CleaningAssigneeAccount]));
  return {
    sections: sectionData,
    history,
    summary: { urgent: urgentCount, flexible: flexibleCount, unassigned: unassignedCount, completed: completedCount },
    referenceAt: referenceAt.toISOString(),
    timeZone,
    date: dateInput,
    companies,
    properties: [...propertyMap.values()],
    rooms: rooms.map(({ id, name, propertyId }) => ({ id, name, propertyId })),
    assignees: [...assigneeMap.values()],
    workers,
  };
}
