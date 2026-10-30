import "server-only";

import type { AccessContext } from "@/features/access-control";
import { roomScopeWhere } from "@/features/access-control/infrastructure/prisma-scope";
import type { InsuranceClaimStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export async function listInsuranceClaims(context: AccessContext, input: { propertyId?: string; status?: InsuranceClaimStatus; page?: number }) {
  const pageSize = 30;
  const page = Math.max(1, input.page ?? 1);
  const where = {
    propertyId: input.propertyId,
    status: input.status,
    room: roomScopeWhere(context.scope) ?? undefined,
  };
  const [total, claims] = await Promise.all([
    prisma.insuranceClaim.count({ where }),
    prisma.insuranceClaim.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, content: true, types: true, status: true, reporterName: true, createdAt: true,
        submittedAt: true, submittedByName: true,
        property: { select: { name: true } }, room: { select: { name: true, code: true } },
        photos: { select: { id: true, originalName: true }, orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  return { claims, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

