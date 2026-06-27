import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { MinioService } from 'nestjs-minio-client';
import { firstValueFrom } from 'rxjs';
import { Readable } from 'stream';

@Injectable()
export class MinioStorageRepository {
  constructor(
    private readonly config: ConfigService,
    private readonly minioService: MinioService,
    @Inject('IMAGE_DELIVERY_EVENTS') private readonly events: ClientProxy,
  ) {}

  getObject(storageKey: string): Promise<Readable> {
    return this.minioService.client.getObject(this.config.get('MINIO_BUCKET'), storageKey);
  }

  async putObject(storageKey: string, stream: Readable | Buffer, metaData?: Record<string, string>): Promise<unknown> {
    const result = await this.minioService.client.putObject(this.config.get('MINIO_BUCKET'), storageKey, stream, metaData);

    await firstValueFrom(this.events.emit(this.config.get('AMQP_MEDIA_OBJECT_WRITE'), { storageKey }));

    return result;
  }

  async removeObject(storageKey: string) {
    await this.minioService.client.removeObject(this.config.get('MINIO_BUCKET'), storageKey);

    await firstValueFrom(this.events.emit(this.config.get('AMQP_MEDIA_OBJECT_DELETE'), { storageKey }));
  }
}
