import type { CleaningPriority } from "./domain/cleaning-priority";

export type CleaningTab = "ongoing" | "history";

export interface CleaningFilters {
  tab: CleaningTab;
  date: string;
  companyId: string | null;
  propertyId: string | null;
  roomId: string | null;
  assigneeId: string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | null;
  priority: CleaningPriority | null;
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
  assignedTo: { id: string; name: string } | null;
  completedBy: { id: string; name: string } | null;
  startedAt: string | null;
  completedAt: string | null;
  reservation: { guestName: string | null; summary: string | null; provider: string; checkoutAt: string } | null;
  nextCheckInAt: string | null;
  photos: CleaningPhotoViewModel[];
  eligibleAssignees: Array<{ id: string; name: string }>;
}

export interface CleaningPageData {
  items: CleaningTaskViewModel[];
  totalCount: number;
  totalPages: number;
  page: number;
  companies: Array<{ id: string; name: string }>;
  properties: Array<{ id: string; name: string; companyId: string }>;
  rooms: Array<{ id: string; name: string; propertyId: string }>;
  assignees: Array<{ id: string; name: string }>;
}
