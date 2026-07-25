import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import type { AccessScope } from "../domain/access-control";

export function propertyScopeWhere(scope?: AccessScope): Prisma.PropertyWhereInput | undefined {
  if (!scope || scope.mode === "all") return undefined;
  const company = { companyId: { in: [...scope.companyIds] } };
  if (scope.propertyIds === undefined && scope.roomIds === undefined) return company;
  return {
    ...company,
    OR: [
      { id: { in: [...(scope.propertyIds ?? [])] } },
      { rooms: { some: { id: { in: [...(scope.roomIds ?? [])] } } } },
    ],
  };
}

export function roomScopeWhere(scope?: AccessScope): Prisma.RoomWhereInput | undefined {
  if (!scope || scope.mode === "all") return undefined;
  const company = { property: { companyId: { in: [...scope.companyIds] } } };
  if (scope.propertyIds === undefined && scope.roomIds === undefined) return company;
  return {
    ...company,
    OR: [
      { propertyId: { in: [...(scope.propertyIds ?? [])] } },
      { id: { in: [...(scope.roomIds ?? [])] } },
    ],
  };
}
