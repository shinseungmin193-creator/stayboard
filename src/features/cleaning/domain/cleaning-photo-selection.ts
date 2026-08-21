export function snapshotCleaningPhotoFiles(files: FileList | null) {
  return Array.from(files ?? []);
}
