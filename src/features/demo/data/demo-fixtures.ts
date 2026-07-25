import { addDays } from "date-fns";
import { getDashboardTodayRange } from "@/features/dashboard/dashboard-time";

export const DEMO_COMPANY = { id: "demo-company", name: "StayBoard Demo Company" } as const;
export const DEMO_PROPERTY = { id: "demo-property", companyId: DEMO_COMPANY.id, name: "StayBoard Demo Hotel", isActive: true } as const;

export function createDemoFixtures(now = new Date()) {
  const { start, end } = getDashboardTodayRange(now);
  const atNoon = (date: Date) => new Date(date.getTime() + 12 * 60 * 60 * 1000);
  const rooms = [
    { id: "demo-room-101", propertyId: DEMO_PROPERTY.id, name: "101호", code: "101", sortOrder: 1, operationalStatus: "CLEANING_REQUIRED" as const },
    { id: "demo-room-102", propertyId: DEMO_PROPERTY.id, name: "102호", code: "102", sortOrder: 2, operationalStatus: "NONE" as const },
    { id: "demo-room-201", propertyId: DEMO_PROPERTY.id, name: "201호", code: "201", sortOrder: 3, operationalStatus: "INSPECTION_REQUIRED" as const },
    { id: "demo-room-202", propertyId: DEMO_PROPERTY.id, name: "202호", code: "202", sortOrder: 4, operationalStatus: "NONE" as const },
  ];
  const reservations = [
    { id: "demo-reservation-1", roomId: rooms[0].id, guestName: "김민수", summary: "Reserved", provider: "AIRBNB" as const, status: "CONFIRMED" as const, startDate: addDays(start, -2), endDate: end, calendarSourceName: "101호 Airbnb" },
    { id: "demo-reservation-2", roomId: rooms[1].id, guestName: "Yuki Tanaka", summary: "Reservation", provider: "BOOKING" as const, status: "CONFIRMED" as const, startDate: atNoon(start), endDate: addDays(end, 2), calendarSourceName: "102호 Booking.com" },
    { id: "demo-reservation-3", roomId: rooms[2].id, guestName: "Demo Guest", summary: "Reservation", provider: "AGODA" as const, status: "CONFIRMED" as const, startDate: addDays(start, 2), endDate: addDays(end, 4), calendarSourceName: "201호 Agoda" },
    { id: "demo-reservation-4", roomId: rooms[2].id, guestName: "Sample Guest", summary: "Reserved", provider: "AIRBNB" as const, status: "CONFIRMED" as const, startDate: addDays(start, 3), endDate: addDays(end, 5), calendarSourceName: "201호 Airbnb" },
    { id: "demo-reservation-5", roomId: rooms[3].id, guestName: "Demo Guest", summary: "Reserved", provider: "AIRBNB" as const, status: "CONFIRMED" as const, startDate: addDays(start, 5), endDate: addDays(end, 7), calendarSourceName: "202호 Airbnb" },
  ];
  return { start, end, rooms, reservations };
}
