import type { UserRole } from "@/features/access-control";
import type { RoomNoteViewModel } from "@/features/room-notes";
import type { CleaningSection } from "./domain/cleaning-meta";
import type { CleaningPriority } from "./domain/cleaning-priority";

export interface CleaningAssigneeAccount {
  id: string;
  name: string;
  role: UserRole;
}

export interface CleaningWorkerViewModel {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  isActive: boolean;
}

export type CleaningSectionFilter = "all" | CleaningSection;
export type CleaningStatusFilter = "UNASSIGNED" | "WAITING" | "IN_PROGRESS" | "COMPLETED";
export type CleaningTab = "ongoing" | "history";

export interface CleaningFilters {
  tab: CleaningTab;
  date: string;
  companyId: string | null;
  propertyId: string | null;
  roomId: string | null;
  assigneeId: string | null;
  status: CleaningStatusFilter | null;
  priority: CleaningPriority | null;
  unassignedOnly: boolean;
  section: CleaningSectionFilter;
  page: number;
}

export interface CleaningPhotoViewModel {
  id: string;
  url: string | null;
  mimeType: string;
  size: number;
  originalName: string;
  createdAt: string;
  deleteAfter: string | null;
  deletedAt: string | null;
}

export interface CleaningTaskLogViewModel {
  id: string;
  action: "ASSIGNED" | "REASSIGNED" | "STARTED" | "START_CANCELLED" | "COMPLETED" | "NOTE_ADDED" | "PHOTO_ADDED";
  actorName: string | null;
  workerName: string | null;
  previousStatus: string | null;
  nextStatus: string | null;
  createdAt: string;
}

export interface CleaningTaskViewModel {
  id: string;
  companyId: string;
  companyName: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  scheduledDate: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: CleaningPriority;
  assignee: { userId: string | null; name: string; assignedAt: string | null; assignedById: string | null } | null;
  startedByName: string | null;
  completedBy: { userId: string | null; name: string } | null;
  cleanerName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
  reservation: { guestName: string | null; summary: string | null; provider: string; checkoutAt: string } | null;
  targetAt: string | null;
  nextCheckInAt: string | null;
  photoCount: number;
  photoRetentionExpired: boolean;
  photos: CleaningPhotoViewModel[];
  logs: CleaningTaskLogViewModel[];
  eligibleAssignees: CleaningAssigneeAccount[];
  openRoomNotes: RoomNoteViewModel[];
}

export interface CleaningSectionData {
  items: CleaningTaskViewModel[];
  totalCount: number;
  totalPages: number;
  page: number;
}

export interface CleaningPageData {
  sections: Record<CleaningSection, CleaningSectionData>;
  history: CleaningSectionData;
  summary: { urgent: number; flexible: number; unassigned: number; completed: number };
  referenceAt: string;
  timeZone: string;
  date: string;
  companies: Array<{ id: string; name: string }>;
  properties: Array<{ id: string; name: string; companyId: string }>;
  rooms: Array<{ id: string; name: string; propertyId: string }>;
  assignees: CleaningAssigneeAccount[];
  workers: CleaningWorkerViewModel[];
}
