export interface FileMetadataEntity {
  uuid: string;
  name: string;
  storageKey: string;
  mime: string;
  size: number;
  status: string;
  expiresAt?: string | null;
  folderUuid: string | null;
  createdAt: string;
  updatedAt: string;
}
