ALTER TABLE "InvitationCode"
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- Existing ADMIN codes remain usable for at least 24 hours after deployment.
-- Historical USED/REVOKED rows receive their original 24-hour window.
UPDATE "InvitationCode"
SET "expiresAt" = CASE
  WHEN "status" = 'ACTIVE' THEN GREATEST("createdAt" + INTERVAL '24 hours', CURRENT_TIMESTAMP + INTERVAL '24 hours')
  ELSE "createdAt" + INTERVAL '24 hours'
END;

ALTER TABLE "InvitationCode"
ALTER COLUMN "expiresAt" SET NOT NULL;

ALTER TABLE "InvitationCode"
DROP CONSTRAINT IF EXISTS "InvitationCode_admin_role_check";

DROP INDEX IF EXISTS "InvitationCode_one_active_per_company_key";

CREATE UNIQUE INDEX "InvitationCode_one_active_per_company_role_key"
ON "InvitationCode"("companyId", "role")
WHERE "status" = 'ACTIVE';

CREATE INDEX "InvitationCode_expiresAt_idx"
ON "InvitationCode"("expiresAt");
