import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinioService } from 'nestjs-minio-client';

@Injectable()
export class HealthService {
  private connected = false;

  constructor(
    private readonly config: ConfigService,
    private readonly minio: MinioService,
  ) {}

  setConsumerConnected(connected: boolean): void {
    this.connected = connected;
  }

  async check(): Promise<{ service: string; status: 'ok' }> {
    if (!this.connected) throw new ServiceUnavailableException('Media RabbitMQ consumer is unavailable');
    try {
      if (!(await this.minio.client.bucketExists(this.config.getOrThrow<string>('MINIO_BUCKET')))) {
        throw new Error('Media bucket is missing');
      }
    } catch {
      throw new ServiceUnavailableException('Media object storage is unavailable');
    }
    return { service: 'sellgar.media.service', status: 'ok' };
  }
}
