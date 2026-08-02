export interface StoredFileUpload {
  taskId: string;
  extension: string;
  data: Uint8Array;
}

export interface StoredFileContents {
  data: Uint8Array;
}

export interface FileStorageProvider {
  upload(file: StoredFileUpload): Promise<{ storageKey: string }>;
  read(storageKey: string): Promise<StoredFileContents>;
  delete(storageKey: string): Promise<void>;
  getUrl(storageKey: string): string;
}
