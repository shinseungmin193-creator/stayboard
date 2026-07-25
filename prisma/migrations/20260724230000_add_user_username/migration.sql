-- Existing accounts remain valid without a username. Seeded developer accounts
-- receive a stable username for identifier-based login.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
