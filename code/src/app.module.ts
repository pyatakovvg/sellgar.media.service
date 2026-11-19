import { HealthModule } from './health/health.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ImagesModule } from './api/images/images.module';
import { FileMetadataModule } from './file-metadata/file-metadata.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      envFilePath: '.env',
      cache: true,
      isGlobal: true,
    }),
    FileMetadataModule,
    StorageModule,
    ImagesModule,
  ],
})
export class AppModule {}
