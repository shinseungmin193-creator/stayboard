import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import type { CompanyMemberRole } from "@/lib/generated/prisma/enums";

export async function createInvitedCompanyMembership(
  tx: Prisma.TransactionClient,
  input: { userId: string; companyId: string; role: CompanyMemberRole },
) {
  const membership = await tx.companyMembership.create({
    data: {
      userId: input.userId,
      companyId: input.companyId,
      role: input.role,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  let propertyIds: string[] = [];
  if (input.role === "STAFF") {
    const properties = await tx.property.findMany({
      where: { companyId: input.companyId, isActive: true },
      select: { id: true },
    });
    propertyIds = properties.map((property) => property.id);
    if (properties.length) {
      await tx.propertyAccess.createMany({
        data: propertyIds.map((propertyId) => ({ membershipId: membership.id, propertyId })),
      });
    }
  }

  return { ...membership, propertyIds };
}
