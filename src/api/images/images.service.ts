import { Injectable, NotFoundException } from '@nestjs/common';

import { FileMetadataGateway } from '../../file-metadata/file-metadata.gateway';
import { MinioStorageRepository } from '../../storage/minio-storage.repository';

@Injectable()
export class ImagesService {
  constructor(
    private readonly fileMetadataGateway: FileMetadataGateway,
    private readonly storageRepository: MinioStorageRepository,
  ) {}

  async getByFileUuid(fileUuid: string) {
    const file = await this.fileMetadataGateway.findByUuid(fileUuid);

    if (!file || file.status !== 'ready') {
      throw new NotFoundException(`Image ${fileUuid} not found`);
    }

    try {
      const stream = await this.storageRepository.getObject(file.storageKey);

      return { file, stream };
    } catch {
      throw new NotFoundException(`Image ${fileUuid} not found`);
    }
  }
}
