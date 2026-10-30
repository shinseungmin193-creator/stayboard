import "server-only";

import { canAccessCompany, canAccessRoom, PermissionDeniedError, requirePermission, ResourceNotFoundError, type Permission } from "@/features/access-control";
import { prisma } from "@/lib/prisma";

export async function requireInsuranceClaimAccess(claimId: string, permission: Permission) {
  const context = await requirePermission(permission);
  const claim = await prisma.insuranceClaim.findUnique({
    where: { id: claimId },
    select: { id: true, companyId: true, propertyId: true, roomId: true, status: true },
  });
  if (!claim) throw new ResourceNotFoundError();
  if (!canAccessCompany(context, claim.companyId) || !canAccessRoom(context, claim)) throw new PermissionDeniedError();
  return { context, claim };
}

