import "server-only";

import {
  canAccessCompany,
  canAccessRoom,
  PermissionDeniedError,
  withAccessAuditMetadata,
  type AccessContext,
} from "@/features/access-control";
import { prisma } from "@/lib/prisma";
import { decryptRoomAccessPassword, encryptRoomAccessPassword } from "./room-access-password-crypto";

export class RoomAccessPasswordServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoomAccessPasswordServiceError";
  }
}

function assertRoomScope(context: AccessContext, room: { id: string; propertyId: string; property: { companyId: string } }) {
  if (!canAccessCompany(context, room.property.companyId) || !canAccessRoom(context, room)) {
    throw new PermissionDeniedError();
  }
}

export async function getRoomAccessPassword(context: AccessContext, roomId: string) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        propertyId: true,
        accessPasswordEncrypted: true,
        property: { select: { companyId: true } },
      },
    });
    if (!room) throw new RoomAccessPasswordServiceError("객실을 찾을 수 없습니다.");
    assertRoomScope(context, room);

    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: room.property.companyId,
        action: "ROOM_ACCESS_PASSWORD_VIEWED",
        details: withAccessAuditMetadata(context, {
          roomId: room.id,
          propertyId: room.propertyId,
          configured: Boolean(room.accessPasswordEncrypted),
        }),
      },
    });

    return {
      password: room.accessPasswordEncrypted
        ? decryptRoomAccessPassword(room.accessPasswordEncrypted)
        : null,
    };
  });
}

export async function updateRoomAccessPassword(context: AccessContext, roomId: string, passwordInput: string) {
  const password = passwordInput.trim();
  const encrypted = password ? encryptRoomAccessPassword(password) : null;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`room-access-password:${roomId}`}))`;
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        propertyId: true,
        accessPasswordEncrypted: true,
        property: { select: { companyId: true } },
      },
    });
    if (!room) throw new RoomAccessPasswordServiceError("객실을 찾을 수 없습니다.");
    assertRoomScope(context, room);

    const updated = await tx.room.updateMany({
      where: { id: room.id },
      data: { accessPasswordEncrypted: encrypted },
    });
    if (updated.count !== 1) throw new RoomAccessPasswordServiceError("비밀번호 상태가 변경되어 저장하지 못했습니다.");

    await tx.auditLog.create({
      data: {
        actorUserId: context.userId,
        targetCompanyId: room.property.companyId,
        action: "ROOM_ACCESS_PASSWORD_UPDATED",
        details: withAccessAuditMetadata(context, {
          roomId: room.id,
          propertyId: room.propertyId,
          previousConfigured: Boolean(room.accessPasswordEncrypted),
          configured: Boolean(encrypted),
        }),
      },
    });
    return { configured: Boolean(encrypted) };
  });
}
