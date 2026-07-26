-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "InvitationMailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "CompanyMembership" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "PropertyAccess" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInvitation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "CompanyMemberRole" NOT NULL,
    "propertyIds" JSONB NOT NULL DEFAULT '[]',
    "message" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "mailStatus" "InvitationMailStatus" NOT NULL DEFAULT 'PENDING',
    "mailError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyAccess_propertyId_idx" ON "PropertyAccess"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyAccess_membershipId_propertyId_key" ON "PropertyAccess"("membershipId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvitation_tokenHash_key" ON "CompanyInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "CompanyInvitation_companyId_email_idx" ON "CompanyInvitation"("companyId", "email");

-- CreateIndex
CREATE INDEX "CompanyInvitation_companyId_createdAt_idx" ON "CompanyInvitation"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyInvitation_email_idx" ON "CompanyInvitation"("email");

-- CreateIndex
CREATE INDEX "CompanyInvitation_expiresAt_idx" ON "CompanyInvitation"("expiresAt");

-- CreateIndex
CREATE INDEX "CompanyMembership_companyId_status_role_idx" ON "CompanyMembership"("companyId", "status", "role");

-- AddForeignKey
ALTER TABLE "PropertyAccess" ADD CONSTRAINT "PropertyAccess_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyAccess" ADD CONSTRAINT "PropertyAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvitation" ADD CONSTRAINT "CompanyInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
