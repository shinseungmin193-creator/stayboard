import { DEFAULT_TIMEZONE } from "../../lib/constants";
import {
  getZonedDateInput,
  getZonedMidnight,
  shiftDateInputByMonths,
} from "../../lib/zoned-date";

export const RESERVATION_DEFAULT_HISTORY_MONTHS = 3;

/**
 * Reservation history is retained indefinitely. This boundary only controls
 * the reservation list's default window; explicit calendar/range queries are
 * intentionally not capped by it.
 */
export function getDefaultReservationHistoryBoundary(
  now = new Date(),
  timeZone = DEFAULT_TIMEZONE,
) {
  const todayInput = getZonedDateInput(now, timeZone);
  const fromInput = shiftDateInputByMonths(
    todayInput,
    -RESERVATION_DEFAULT_HISTORY_MONTHS,
  );
  return {
    todayInput,
    fromInput,
    from: getZonedMidnight(fromInput, timeZone),
  };
}
