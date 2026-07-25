export type StatIconName = "checkin" | "checkout" | "priority-cleaning" | "flexible-cleaning" | "overbooking" | "sync-failure";

export interface DashboardRoomSummary {
  id: string;
  name: string;
  propertyName: string;
}

export interface DashboardStatCardData {
  label: string;
  count: number;
  description?: string;
  iconName: StatIconName;
  iconClassName?: string;
  href?: string;
  rooms: DashboardRoomSummary[];
}
