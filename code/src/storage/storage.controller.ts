import { BadRequestException, Controller, Headers, Put, Req } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Request } from 'express';
import { buffer } from 'stream/consumers';
import sharp from 'sharp';

import { MinioStorageRepository } from './minio-storage.repository';

@Controller('internal/objects')
export class StorageController {
  constructor(private readonly storageRepository: MinioStorageRepository) {}

  @Put()
  async upload(
    @Headers('x-file-uuid') fileUuid: string,
    @Headers('x-media-profile') profile = 'raw',
    @Headers('content-type') contentType = 'application/octet-stream',
    @Req() req: Request,
  ) {
    if (!fileUuid) {
      throw new BadRequestException('X-File-Uuid header is required');
    }

    const input = await buffer(req);
    const object = profile === 'image' ? await this.processImage(fileUuid, input) : this.createRawObject(fileUuid, contentType, input);

    await this.storageRepository.putObject(object.storageKey, object.buffer, {
      'Content-Type': object.mime,
    });

    return {
      storageKey: object.storageKey,
      mime: object.mime,
      size: object.buffer.length,
    };
  }

  @MessagePattern({ cmd: 'media.object.delete' })
  async removeObject(@Payload('storageKey') storageKey: string) {
    await this.storageRepository.removeObject(storageKey);

    return { storageKey };
  }

  private async processImage(fileUuid: string, input: Buffer) {
    const image = sharp(input);
    const meta = await image.metadata();

    if (!meta.format) {
      throw new BadRequestException('Unsupported image');
    }

    if (meta.width && meta.width > 800 && meta.height && meta.height > 800) {
      image.resize({ height: 800 });
    } else if (meta.width && meta.width > 800) {
      image.resize({ width: 800 });
    } else if (meta.height && meta.height > 800) {
      image.resize({ height: 800 });
    }

    image.webp({ preset: 'photo' });

    return {
      storageKey: `images/${fileUuid}.webp`,
      mime: 'image/webp',
      buffer: await image.toBuffer(),
    };
  }

  private createRawObject(fileUuid: string, contentType: string, input: Buffer) {
    const extension = this.getExtension(contentType);

    return {
      storageKey: `files/${fileUuid}.${extension}`,
      mime: contentType,
      buffer: input,
    };
  }

  private getExtension(mime: string) {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'application/pdf': 'pdf',
    };

    return map[mime] ?? 'bin';
  }
}
