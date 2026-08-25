import { loadEnvConfig } from "@next/env";
import { Client } from "pg";
import { getZonedDateInput, getZonedMidnight, isValidDateInput, shiftDateInput } from "../src/lib/zoned-date";

interface CheckoutReservationRow {
  id: string;
  companyId: string;
  companyName: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomName: string;
  calendarSourceId: string;
  calendarSourceName: string;
  calendarSourceActive: boolean;
  provider: string;
  providerReservationId: string | null;
  rawUid: string;
  startDate: Date;
  endDate: Date;
  status: string;
  roomActive: boolean;
  propertyActive: boolean;
  companyActive: boolean;
}

interface CleaningTaskRow {
  id: string;
  reservationId: string | null;
  roomId: string;
  propertyId: string;
  scheduledDate: Date;
  status: string;
}

const argumentsList = process.argv.slice(2);
const dateArgument = argumentsList.find((argument) => argument.startsWith("--date="));
const dateInput = dateArgument?.slice("--date=".length) ?? getZonedDateInput(new Date());
if (argumentsList.some((argument) => !argument.startsWith("--date=")) || !isValidDateInput(dateInput)) {
  throw new Error("--date=YYYY-MM-DD만 사용할 수 있습니다.");
}
const start = getZonedMidnight(dateInput);
const end = getZonedMidnight(shiftDateInput(dateInput, 1));

function groupedDuplicates(
  reservations: readonly CheckoutReservationRow[],
  key: (reservation: CheckoutReservationRow) => string | null,
) {
  const groups = new Map<string, CheckoutReservationRow[]>();
  for (const reservation of reservations) {
    const value = key(reservation);
    if (!value) continue;
    const group = groups.get(value) ?? [];
    group.push(reservation);
    groups.set(value, group);
  }
  return [...groups.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([value, values]) => ({ value, reservationIds: values.map((reservation) => reservation.id) }));
}

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경 변수가 필요합니다.");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const reservations = (await client.query<CheckoutReservationRow>(`
      SELECT reservation.id, company.id AS "companyId", company.name AS "companyName",
        property.id AS "propertyId", property.name AS "propertyName",
        room.id AS "roomId", room.name AS "roomName",
        source.id AS "calendarSourceId", source.name AS "calendarSourceName",
        source."isActive" AS "calendarSourceActive",
        reservation.provider::text AS provider,
        reservation."providerReservationId", reservation."rawUid",
        reservation."startDate", reservation."endDate", reservation.status::text AS status,
        room."isActive" AS "roomActive", property."isActive" AS "propertyActive",
        company."isActive" AS "companyActive"
      FROM "Reservation" reservation
      JOIN "CalendarSource" source ON source.id = reservation."calendarSourceId"
      JOIN "Room" room ON room.id = reservation."roomId"
      JOIN "Property" property ON property.id = reservation."propertyId"
      JOIN "Company" company ON company.id = property."companyId"
      WHERE reservation."endDate" > $1 AND reservation."endDate" <= $2
      ORDER BY property.name, room.name, reservation."startDate", reservation.id
    `, [start, end])).rows;
    const operational = reservations.filter((reservation) => (
      (reservation.status === "CONFIRMED" || reservation.status === "TENTATIVE")
      && ["AIRBNB", "BOOKING", "AGODA"].includes(reservation.provider)
      && reservation.calendarSourceActive
      && reservation.roomActive
      && reservation.propertyActive
      && reservation.companyActive
    ));
    const tasks = (await client.query<CleaningTaskRow>(`
      SELECT id, "reservationId", "roomId", "propertyId", "scheduledDate", status::text AS status
      FROM "CleaningTask"
      WHERE "scheduledDate" > $1 AND "scheduledDate" <= $2
      ORDER BY "scheduledDate", id
    `, [start, end])).rows;
    const tasksByReservation = new Map<string, CleaningTaskRow[]>();
    for (const task of tasks) {
      if (!task.reservationId) continue;
      const values = tasksByReservation.get(task.reservationId) ?? [];
      values.push(task);
      tasksByReservation.set(task.reservationId, values);
    }

    console.log(JSON.stringify({
      date: dateInput,
      range: { start: start.toISOString(), end: end.toISOString(), checkoutBoundary: "endDate > start && endDate <= end" },
      counts: {
        rowsEndingInRange: reservations.length,
        operationalCheckouts: operational.length,
        cleaningTasksInRange: tasks.length,
        operationalCleaningTasks: tasks.filter((task) => task.status !== "CANCELLED").length,
      },
      excludedCheckoutRows: reservations
        .filter((reservation) => !operational.includes(reservation))
        .map((reservation) => ({
          id: reservation.id,
          status: reservation.status,
          provider: reservation.provider,
          calendarSourceActive: reservation.calendarSourceActive,
          roomActive: reservation.roomActive,
          propertyActive: reservation.propertyActive,
          companyActive: reservation.companyActive,
        })),
      operationalCheckouts: operational.map((reservation) => ({
        ...reservation,
        startDate: reservation.startDate.toISOString(),
        endDate: reservation.endDate.toISOString(),
        cleaningTasks: (tasksByReservation.get(reservation.id) ?? []).map((task) => ({
          cleaningTaskId: task.id,
          status: task.status,
          scheduledDate: task.scheduledDate.toISOString(),
          aligned: task.scheduledDate.getTime() === reservation.endDate.getTime(),
        })),
        cleaningClassification: tasksByReservation.has(reservation.id)
          ? (tasksByReservation.get(reservation.id) ?? []).map((task) => task.status)
          : ["MISSING"],
      })),
      duplicates: {
        sameRoom: groupedDuplicates(operational, (reservation) => reservation.roomId),
        sameStayAcrossSources: groupedDuplicates(operational, (reservation) => (
          `${reservation.roomId}|${reservation.provider}|${reservation.startDate.toISOString()}|${reservation.endDate.toISOString()}`
        )),
        sameProviderReservationId: groupedDuplicates(operational, (reservation) => (
          reservation.providerReservationId ? `${reservation.provider}|${reservation.providerReservationId}` : null
        )),
        sameRawUid: groupedDuplicates(operational, (reservation) => `${reservation.provider}|${reservation.rawUid}`),
      },
      orphanOrUnmatchedCleaningTasks: tasks.filter((task) => (
        !task.reservationId || !operational.some((reservation) => reservation.id === task.reservationId)
      )).map((task) => ({
        ...task,
        scheduledDate: task.scheduledDate.toISOString(),
      })),
    }, null, 2));
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "체크아웃 진단에 실패했습니다.");
  process.exitCode = 1;
});
