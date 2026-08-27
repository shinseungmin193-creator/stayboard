import type { RoomNoteSourceType, RoomNoteStatus, RoomNoteStatusFilter } from "./domain/room-note";

export interface RoomNotePhoto {
  id: string;
  url: string | null;
  mimeType: string;
  size: number;
  originalName: string;
  createdAt: string;
  deleteAfter: string | null;
  deletedAt: string | null;
}

export interface RoomNoteFilters {
  propertyId: string | null;
  roomId: string | null;
  query: string;
  status: RoomNoteStatusFilter;
  page: number;
}

export interface RoomNoteViewModel {
  id: string;
  sourceType: RoomNoteSourceType;
  sourceId: string;
  status: RoomNoteStatus;
  propertyId: string;
  propertyName: string;
  propertyTimeZone: string;
  roomId: string;
  roomName: string;
  content: string;
  authorName: string;
  createdAt: string;
  completedAt: string | null;
  completedByName: string | null;
  cleaningTaskId: string | null;
  cleaningDate: string | null;
  photoCount: number;
  photos: RoomNotePhoto[];
}

export interface RoomNotePropertyOption {
  id: string;
  name: string;
  isActive: boolean;
}

export interface RoomNoteRoomOption {
  id: string;
  propertyId: string;
  propertyName: string;
  name: string;
  isActive: boolean;
  canCreate: boolean;
}

export interface RoomNoteOptions {
  properties: RoomNotePropertyOption[];
  rooms: RoomNoteRoomOption[];
}

export interface RoomNotePageResult {
  items: RoomNoteViewModel[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
