-- New and updated reservations must always describe a positive stay range.
-- NOT VALID keeps deployment safe if another environment has legacy rows;
-- `npm run audit:data` reports those rows before a later VALIDATE step.
ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_valid_date_range_check"
CHECK ("startDate" < "endDate") NOT VALID;

-- Conflict pairs are canonicalized in application code. Enforcing the order
-- also prevents the reverse pair (B, A) bypassing the existing unique index.
ALTER TABLE "ReservationConflict"
ADD CONSTRAINT "ReservationConflict_canonical_pair_check"
CHECK ("reservationAId" < "reservationBId") NOT VALID;

-- Reservation removal must pass through the source-scoped cleanup service,
-- which deletes or detaches CleaningTask history before deleting reservations.
ALTER TABLE "CleaningTask"
DROP CONSTRAINT "CleaningTask_reservationId_fkey";

ALTER TABLE "CleaningTask"
ADD CONSTRAINT "CleaningTask_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
