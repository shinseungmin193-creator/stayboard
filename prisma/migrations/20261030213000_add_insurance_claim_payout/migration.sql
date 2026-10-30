ALTER TYPE "InsuranceClaimStatus" ADD VALUE 'PAID';

ALTER TABLE "InsuranceClaim"
ADD COLUMN "paidAmount" INTEGER,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paidByUserId" TEXT,
ADD COLUMN "paidByName" TEXT;

CREATE INDEX "InsuranceClaim_paidByUserId_paidAt_idx" ON "InsuranceClaim"("paidByUserId", "paidAt");

ALTER TABLE "InsuranceClaim"
ADD CONSTRAINT "InsuranceClaim_paidByUserId_fkey"
FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
