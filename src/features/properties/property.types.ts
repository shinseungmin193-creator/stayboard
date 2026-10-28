export interface PropertyListItem {
  id: string; companyId: string; companyName: string; name: string; address: string;
  timezone: string; isActive: boolean; totalRooms: number; activeRooms: number;
}

export interface PropertyOption { id: string; companyId: string; name: string; isActive: boolean }

export interface PropertyDeleteImpact {
  roomCount: number;
  reservationCount: number;
  calendarSourceCount: number;
  syncHistoryCount: number;
  conflictCount: number;
  cleaningTaskCount: number;
  cleaningPhotoCount: number;
  roomNoteCount: number;
  roomListingCount: number;
  reviewDataCount: number;
  accessAssignmentCount: number;
}

export interface PropertyDeleteTarget {
  id: string;
  companyId: string;
  name: string;
  roomIds: string[];
  calendarSourceIds: string[];
  roomListingIds: string[];
}

export interface PropertyDeleteResult extends PropertyDeleteImpact {
  propertyId: string;
  propertyName: string;
  deletedPhotoFileCount: number;
  failedPhotoFileCount: number;
}
