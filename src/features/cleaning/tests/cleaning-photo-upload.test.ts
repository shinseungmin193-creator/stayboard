import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(path, "utf8");
}

test("completion workflow requires the shared photo uploader to finish before completion", () => {
  const workflow = source("src/features/cleaning/components/cleaning-workflow-dialog.tsx");
  assert.match(workflow, /<CleaningPhotoUploader/);
  assert.match(workflow, /mode !== "complete" \|\| photoState\.readyForCompletion/);
  assert.match(workflow, /photoState\.isUploading \|\| !valid/);
});

test("mobile photo uploader provides separate camera and multiple gallery inputs", () => {
  const uploader = source("src/features/cleaning/components/cleaning-photo-uploader.tsx");
  const galleryInput = uploader.match(/<input ref=\{galleryInputRef\}[^>]*>/)?.[0];
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /ref=\{galleryInputRef\}[^>]*multiple/);
  assert.ok(galleryInput);
  assert.doesNotMatch(galleryInput, /capture=/);
  assert.match(uploader, /accept=\{CLEANING_PHOTO_ACCEPT\}/);
  assert.match(uploader, /xhr\.upload\.onprogress/);
  assert.match(uploader, /withBasePath\(`\/api\/cleaning\/tasks\/\$\{input\.taskId\}\/photos`\)/);
});

test("desktop cleaning primary action uses an unobstructed native button", () => {
  const card = source("src/features/cleaning/components/cleaning-task-card.tsx");
  assert.match(card, /relative z-10 flex min-w-0 items-center justify-end/);
  assert.match(card, /<button\s+type="button"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?action\.run\(\);/);
  assert.doesNotMatch(card, /<Link[^>]*>[\s\S]*?<button/);
});

test("upload retries retain a client id and the server enforces idempotency", () => {
  const uploader = source("src/features/cleaning/components/cleaning-photo-uploader.tsx");
  const route = source("src/app/api/cleaning/tasks/[taskId]/photos/route.ts");
  const schema = source("prisma/schema.prisma");
  assert.match(uploader, /X-Cleaning-Upload-Id/);
  assert.match(route, /taskId_clientUploadId/);
  assert.ok(route.indexOf("findExistingUpload(routeTaskId, uploadId)") < route.indexOf('task.status !== "PENDING"'));
  assert.match(schema, /@@unique\(\[taskId, clientUploadId\]\)/);
});

test("production deployment verifies persistent storage, proxy size, and retention cleanup", () => {
  const deployment = source("VPS 배포.bat");
  const nginx = source("deploy/nginx/stayboard-cleaning-upload.conf");
  assert.match(deployment, /verify-cleaning-photo-storage\.mjs/);
  assert.match(deployment, /UPLOAD_STATUS/);
  assert.match(deployment, /cleanup:cleaning-photos/);
  assert.match(nginx, /client_max_body_size 12m/);
});
