import { isAccessControlError, PERMISSIONS } from "@/features/access-control";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { requireInsuranceClaimAccess } from "@/features/insurance-claims/server/insurance-claim-access";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const photo = await prisma.insuranceClaimPhoto.findUnique({ where: { id: (await params).photoId }, select: { storageKey: true, mimeType: true, size: true, insuranceClaimId: true } });
    if (!photo) return new Response(null, { status: 404 });
    await requireInsuranceClaimAccess(photo.insuranceClaimId, PERMISSIONS.INSURANCE_CLAIM_READ);
    const file = await getCleaningPhotoStorage().read(photo.storageKey);
    return new Response(file.data, { headers: { "Cache-Control": "private, no-store", "Content-Length": String(photo.size), "Content-Type": photo.mimeType, "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (isAccessControlError(error) || (error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    logServerError("insurance-claim.photo.read", error);
    return new Response(null, { status: 500 });
  }
}
