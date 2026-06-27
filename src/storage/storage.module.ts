import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MinioModule } from 'nestjs-minio-client';

import { MinioStorageRepository } from './minio-storage.repository';
import { StorageController } from './storage.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'IMAGE_DELIVERY_EVENTS',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              {
                protocol: 'amqp',
                hostname: config.get('AMQP_HOSTNAME'),
                port: config.get('AMQP_PORT'),
                username: config.get('AMQP_USERNAME'),
                password: config.get('AMQP_PASSWORD'),
              },
            ],
            queue: config.get('AMQP_MEDIA_SRV_EVENT_QUEUE'),
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
    MinioModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        endPoint: config.get<string>('MINIO_ENDPOINT'),
        port: Number(config.get('MINIO_PORT')),
        useSSL: false,
        accessKey: config.get<string>('MINIO_ACCESS_KEY'),
        secretKey: config.get<string>('MINIO_SECRET_KEY'),
      }),
    }),
  ],
  controllers: [StorageController],
  providers: [MinioStorageRepository],
  exports: [MinioStorageRepository],
})
export class StorageModule {}
