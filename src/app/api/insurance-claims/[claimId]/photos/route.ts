import { isAccessControlError, PERMISSIONS, withAccessAuditMetadata } from "@/features/access-control";
import { MAX_CLEANING_PHOTO_REQUEST_SIZE, validateCleaningPhoto } from "@/features/cleaning/domain/cleaning-photo-validation";
import { normalizeCleaningPhoto } from "@/features/cleaning/server/cleaning-photo-image";
import { getCleaningPhotoStorage } from "@/features/cleaning/storage/local-file-storage-provider";
import { requireInsuranceClaimAccess } from "@/features/insurance-claims/server/insurance-claim-access";
import { withBasePath } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/prisma-errors";

export const runtime = "nodejs";
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeOriginalName(name: string) {
  return name.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180) || "photo";
}

function responsePhoto(photo: { id: string; originalName: string; mimeType: string; size: number; createdAt: Date }, status: number) {
  return Response.json({ success: true, photo: { id: photo.id, url: withBasePath(`/api/insurance-claims/photos/${encodeURIComponent(photo.id)}`), originalName: photo.originalName, mimeType: photo.mimeType, size: photo.size, createdAt: photo.createdAt.toISOString() } }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ claimId: string }> }) {
  let uploadedStorageKey: string | null = null;
  try {
    const { claimId } = await params;
    const { context, claim } = await requireInsuranceClaimAccess(claimId, PERMISSIONS.INSURANCE_CLAIM_CREATE);
    if (claim.status !== "REPORTED") return Response.json({ success: false, message: "신청 완료된 보고에는 사진을 추가할 수 없습니다." }, { status: 409 });
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const contentLength = Number(request.headers.get("content-length"));
    if (!contentType.startsWith("multipart/form-data;")) return Response.json({ success: false, message: "사진 형식을 확인해 주세요." }, { status: 415 });
    if (Number.isFinite(contentLength) && contentLength > MAX_CLEANING_PHOTO_REQUEST_SIZE) return Response.json({ success: false, message: "사진 용량이 너무 큽니다." }, { status: 413 });
    const uploadId = request.headers.get("x-insurance-claim-upload-id")?.trim() ?? "";
    if (!UPLOAD_ID_PATTERN.test(uploadId)) return Response.json({ success: false, message: "잘못된 업로드 요청입니다." }, { status: 400 });
    const existing = await prisma.insuranceClaimPhoto.findUnique({ where: { insuranceClaimId_clientUploadId: { insuranceClaimId: claimId, clientUploadId: uploadId } } });
    if (existing) return responsePhoto(existing, 200);
    const formData = await request.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) return Response.json({ success: false, message: "사진을 선택해 주세요." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validation = validateCleaningPhoto({ declaredMimeType: file.type, size: file.size, bytes });
    if (!validation.valid) return Response.json({ success: false, message: validation.reason === "tooLarge" ? "사진 용량이 너무 큽니다." : "지원하지 않는 사진 형식입니다." }, { status: validation.reason === "tooLarge" ? 413 : 415 });
    const normalized = await normalizeCleaningPhoto(bytes, validation);
    const storage = getCleaningPhotoStorage();
    const uploaded = await storage.upload({ taskId: `insurance-${claimId}`, extension: normalized.extension, data: normalized.data });
    uploadedStorageKey = uploaded.storageKey;
    const photo = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`insurance-photo:${claimId}`}))`;
      if (await tx.insuranceClaimPhoto.count({ where: { insuranceClaimId: claimId } }) >= 12) throw new Error("INSURANCE_PHOTO_LIMIT");
      const created = await tx.insuranceClaimPhoto.create({ data: { insuranceClaimId: claimId, clientUploadId: uploadId, storageKey: uploaded.storageKey, originalName: sanitizeOriginalName(file.name), mimeType: normalized.mimeType, size: normalized.data.byteLength, width: normalized.width, height: normalized.height, uploadedById: context.userId } });
      await tx.auditLog.create({ data: { actorUserId: context.userId, targetCompanyId: claim.companyId, action: "INSURANCE_CLAIM_PHOTO_ADDED", details: withAccessAuditMetadata(context, { insuranceClaimId: claimId, roomId: claim.roomId, photoId: created.id }) } });
      return created;
    });
    uploadedStorageKey = null;
    return responsePhoto(photo, 201);
  } catch (error) {
    if (uploadedStorageKey) await getCleaningPhotoStorage().delete(uploadedStorageKey).catch(() => undefined);
    if (isAccessControlError(error)) return Response.json({ success: false, message: "접근 권한이 없습니다." }, { status: 403 });
    if (error instanceof Error && error.message === "INSURANCE_PHOTO_LIMIT") return Response.json({ success: false, message: "사진은 최대 12장까지 등록할 수 있습니다." }, { status: 409 });
    logServerError("insurance-claim.photo.upload", error);
    return Response.json({ success: false, message: "사진을 업로드하지 못했습니다." }, { status: 500 });
  }
}

