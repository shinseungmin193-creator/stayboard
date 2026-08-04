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
  const validation = source("src/features/cleaning/domain/cleaning-photo-validation.ts");
  const galleryInput = uploader.match(/<input id=\{galleryInputId\}[^>]*>/)?.[0];
  assert.match(uploader, /capture="environment"/);
  assert.match(uploader, /ref=\{galleryInputRef\}[^>]*multiple/);
  assert.ok(galleryInput);
  assert.doesNotMatch(galleryInput, /capture=/);
  assert.match(uploader, /accept=\{CLEANING_PHOTO_ACCEPT\}/);
  assert.match(validation, /CLEANING_PHOTO_ACCEPT = "image\/\*"/);
  assert.match(uploader, /captureInputId = `cleaning-photo-capture-\$\{safeTaskId\}-\$\{inputInstanceId\}`/);
  assert.match(uploader, /galleryInputId = `cleaning-photo-gallery-\$\{safeTaskId\}-\$\{inputInstanceId\}`/);
  assert.match(uploader, /htmlFor=\{captureInputId\}/);
  assert.match(uploader, /htmlFor=\{galleryInputId\}/);
  assert.match(uploader, /className="sr-only"/);
  assert.match(uploader, /xhr\.upload\.onprogress/);
  assert.match(uploader, /withBasePath\(`\/api\/cleaning\/tasks\/\$\{input\.taskId\}\/photos`\)/);
});

test("pending cleaning tasks expose an unobstructed start button independent of assignment", () => {
  const card = source("src/features/cleaning/components/cleaning-task-card.tsx");
  assert.match(card, /: \{ label: t\("actions\.start"\), icon: Play/);
  assert.match(card, /primaryActionDisabled = pending \|\| \(task\.status === "IN_PROGRESS" && !canWork\)/);
  assert.match(card, /data-cleaning-primary-action=\{task\.id\}/);
  assert.match(card, /<button\s+type="button"[\s\S]*?event\.stopPropagation\(\);[\s\S]*?action\.run\(\);/);
  assert.doesNotMatch(card, /<Link[^>]*>[\s\S]*?<button/);
  assert.doesNotMatch(card, /relative z-10 flex min-w-0 items-center justify-end/);
});

test("start and photo endpoints rely on scoped CLEANING_MANAGE access rather than assignment ownership", () => {
  const actions = source("src/features/cleaning/cleaning.actions.ts");
  const route = source("src/app/api/cleaning/tasks/[taskId]/photos/route.ts");
  const startAction = actions.slice(actions.indexOf("export async function startCleaningTaskAction"), actions.indexOf("export async function completeCleaningTaskAction"));
  assert.match(startAction, /requireCleaningTaskAccess\(parsed\.data\.taskId, PERMISSIONS\.CLEANING_MANAGE\)/);
  assert.doesNotMatch(startAction, /canWorkOnCleaningTask/);
  assert.match(route, /requireCleaningTaskAccess\(routeTaskId, PERMISSIONS\.CLEANING_MANAGE\)/);
  assert.doesNotMatch(route, /canWorkOnCleaningTask/);
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
