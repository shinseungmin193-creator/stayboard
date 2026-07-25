export interface PropertyListItem {
  id: string; companyId: string; companyName: string; name: string; address: string;
  timezone: string; isActive: boolean; totalRooms: number; activeRooms: number;
}

export interface PropertyOption { id: string; companyId: string; name: string; isActive: boolean }
