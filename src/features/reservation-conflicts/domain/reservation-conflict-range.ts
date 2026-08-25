import { DEFAULT_TIMEZONE } from "../../../lib/constants";
import { getZonedDayRange, getZonedMidnight, shiftDateInput } from "../../../lib/zoned-date";
import { RESERVATION_CONFLICT_DEFAULT_FUTURE_DAYS, RESERVATION_CONFLICT_DEFAULT_PAST_DAYS } from "../reservation-conflict.constants";

export function getDefaultReservationConflictRange(now = new Date(), timeZone = DEFAULT_TIMEZONE) {
  const today = getZonedDayRange(now, timeZone);
  const fromInput = shiftDateInput(today.dateInput, -RESERVATION_CONFLICT_DEFAULT_PAST_DAYS);
  const toInput = shiftDateInput(today.dateInput, RESERVATION_CONFLICT_DEFAULT_FUTURE_DAYS);
  return {
    todayInput: today.dateInput,
    todayStart: today.start,
    fromInput,
    toInput,
    from: getZonedMidnight(fromInput, timeZone),
    toExclusive: getZonedMidnight(shiftDateInput(toInput, 1), timeZone),
  };
}

