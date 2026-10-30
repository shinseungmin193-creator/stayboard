CREATE TYPE "InsuranceClaimStatus" AS ENUM ('REPORTED', 'SUBMITTED');
CREATE TYPE "InsuranceClaimType" AS ENUM ('FIRE_INSURANCE', 'AIRBNB', 'BOOKING', 'AGODA', 'EXPEDIA');

CREATE TABLE "InsuranceClaim" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "reporterName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "types" "InsuranceClaimType"[] NOT NULL,
    "status" "InsuranceClaimStatus" NOT NULL DEFAULT 'REPORTED',
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "submittedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InsuranceClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InsuranceClaimPhoto" (
    "id" TEXT NOT NULL,
    "insuranceClaimId" TEXT NOT NULL,
    "clientUploadId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsuranceClaimPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InsuranceClaim_companyId_status_createdAt_id_idx" ON "InsuranceClaim"("companyId", "status", "createdAt", "id");
CREATE INDEX "InsuranceClaim_propertyId_status_createdAt_id_idx" ON "InsuranceClaim"("propertyId", "status", "createdAt", "id");
CREATE INDEX "InsuranceClaim_roomId_status_createdAt_id_idx" ON "InsuranceClaim"("roomId", "status", "createdAt", "id");
CREATE INDEX "InsuranceClaim_reporterUserId_createdAt_idx" ON "InsuranceClaim"("reporterUserId", "createdAt");
CREATE INDEX "InsuranceClaim_submittedByUserId_submittedAt_idx" ON "InsuranceClaim"("submittedByUserId", "submittedAt");
CREATE UNIQUE INDEX "InsuranceClaimPhoto_storageKey_key" ON "InsuranceClaimPhoto"("storageKey");
CREATE UNIQUE INDEX "InsuranceClaimPhoto_insuranceClaimId_clientUploadId_key" ON "InsuranceClaimPhoto"("insuranceClaimId", "clientUploadId");
CREATE INDEX "InsuranceClaimPhoto_insuranceClaimId_createdAt_idx" ON "InsuranceClaimPhoto"("insuranceClaimId", "createdAt");
CREATE INDEX "InsuranceClaimPhoto_uploadedById_createdAt_idx" ON "InsuranceClaimPhoto"("uploadedById", "createdAt");

ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaim" ADD CONSTRAINT "InsuranceClaim_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaimPhoto" ADD CONSTRAINT "InsuranceClaimPhoto_insuranceClaimId_fkey" FOREIGN KEY ("insuranceClaimId") REFERENCES "InsuranceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsuranceClaimPhoto" ADD CONSTRAINT "InsuranceClaimPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
