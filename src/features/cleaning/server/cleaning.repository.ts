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
import { parseCleaningDate } from "../domain/cleaning-date";
import type { CleaningSection } from "../domain/cleaning-meta";
import { classifyCleaningPriority } from "../domain/cleaning-priority";
import { getCleaningPhotoStorage } from "../storage/local-file-storage-provider";

const SECTION_PAGE_SIZE = 20;
const SECTION_PREVIEW_SIZE = 8;
const ACTIVE_RESERVATION_STATUSES = ["CONFIRMED", "TENTATIVE"] as const;

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
  const timeZone = await resolveCleaningTimeZone(context, filters);
  const { dateInput, start, end } = parseCleaningDate(filters.date, new Date(), timeZone);
  const sameDayCheckIn: Prisma.ReservationWhereInput = {
    status: { in: [...ACTIVE_RESERVATION_STATUSES] },
    startDate: { gte: start, lt: end },
  };
  const sharedAnd: Prisma.CleaningTaskWhereInput[] = [
    scopeRoomWhere ? { room: { is: scopeRoomWhere } } : {},
    { scheduledDate: { gte: start, lt: end } },
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
  const sectionWhere = (section: CleaningSection): Prisma.CleaningTaskWhereInput => ({
    AND: [
      ...sharedAnd,
      visibleStatus,
      section === "completed" ? { status: "COMPLETED" } : { status: { in: ["PENDING", "IN_PROGRESS"] } },
      section === "completed"
        ? filters.priority ? priorityWhere(filters.priority) : {}
        : priorityWhere(section),
      filters.priority && section !== "completed" && filters.priority !== section ? { id: "__hidden_section__" } : {},
      filters.status === "COMPLETED" && section !== "completed" ? { id: "__hidden_section__" } : {},
      filters.status && filters.status !== "COMPLETED" && section === "completed" ? { id: "__hidden_section__" } : {},
    ],
  });
  const summaryBase = { AND: sharedAnd } satisfies Prisma.CleaningTaskWhereInput;

  const [companies, rooms, memberships, urgentCount, flexibleCount, completedCount, unassignedCount] = await Promise.all([
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
    prisma.cleaningTask.count({ where: { AND: [summaryBase, { status: { in: ["PENDING", "IN_PROGRESS"] } }, priorityWhere("urgent")] } }),
    prisma.cleaningTask.count({ where: { AND: [summaryBase, { status: { in: ["PENDING", "IN_PROGRESS"] } }, priorityWhere("flexible")] } }),
    prisma.cleaningTask.count({ where: { AND: [summaryBase, { status: "COMPLETED" }] } }),
    prisma.cleaningTask.count({ where: { AND: [summaryBase, { status: "PENDING", assignedToId: null, assigneeName: null }] } }),
  ]);

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
    startedAt: true,
    completedById: true,
    completedByName: true,
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
    _count: { select: { photos: true } },
  } satisfies Prisma.CleaningTaskSelect;

  const [visibleUrgentCount, visibleFlexibleCount, visibleCompletedCount] = await Promise.all([
    prisma.cleaningTask.count({ where: sectionWhere("urgent") }),
    prisma.cleaningTask.count({ where: sectionWhere("flexible") }),
    prisma.cleaningTask.count({ where: sectionWhere("completed") }),
  ]);
  const counts = { urgent: visibleUrgentCount, flexible: visibleFlexibleCount, completed: visibleCompletedCount };
  const sections = ["urgent", "flexible", "completed"] as const;
  const sectionRows = await Promise.all(sections.map(async (section) => {
    if (filters.section !== "all" && filters.section !== section) return [];
    const page = filters.section === section ? Math.min(filters.page, Math.max(1, Math.ceil(counts[section] / SECTION_PAGE_SIZE))) : 1;
    return prisma.cleaningTask.findMany({
      where: sectionWhere(section),
      select: taskSelect,
      orderBy: section === "completed" ? [{ completedAt: "desc" }, { id: "desc" }] : [{ scheduledDate: "asc" }, { id: "asc" }],
      skip: filters.section === section ? (page - 1) * SECTION_PAGE_SIZE : 0,
      take: filters.section === section ? SECTION_PAGE_SIZE : SECTION_PREVIEW_SIZE,
    });
  }));

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
    const completedByName = task.completedByName ?? task.completedBy?.name ?? null;
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
      startedByName: task.startedByName,
      completedBy: completedByName ? { userId: task.completedById, name: completedByName } : null,
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
    };
  };
  const sectionData = Object.fromEntries(sections.map((section, index) => {
    const totalCount = counts[section];
    const totalPages = Math.max(1, Math.ceil(totalCount / SECTION_PAGE_SIZE));
    const page = filters.section === section ? Math.min(filters.page, totalPages) : 1;
    return [section, { items: sectionRows[index].map(toViewModel), totalCount, totalPages, page } satisfies CleaningSectionData];
  })) as Record<CleaningSection, CleaningSectionData>;

  const propertyMap = new Map(rooms.map((room) => [room.property.id, room.property]));
  const assigneeMap = new Map(memberships.map((membership) => [membership.user.id, {
    id: membership.user.id,
    name: membership.user.name,
    role: membership.role,
  } satisfies CleaningAssigneeAccount]));
  return {
    sections: sectionData,
    summary: { urgent: urgentCount, flexible: flexibleCount, unassigned: unassignedCount, completed: completedCount },
    referenceAt: new Date().toISOString(),
    timeZone,
    date: dateInput,
    companies,
    properties: [...propertyMap.values()],
    rooms: rooms.map(({ id, name, propertyId }) => ({ id, name, propertyId })),
    assignees: [...assigneeMap.values()],
  };
}
